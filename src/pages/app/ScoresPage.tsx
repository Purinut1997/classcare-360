import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  ClipboardList,
  Copy,
  Download,
  FileSpreadsheet,
  Gauge,
  GraduationCap,
  HelpCircle,
  Info,
  Keyboard,
  Layers,
  Lightbulb,
  Plus,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Square,
  Table,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ContextLink as Link } from '../../components/navigation/ContextLink';
import { ThaiDatePicker } from '../../components/shared/ThaiDatePicker';

import { getBangkokDate } from '../../lib/date';
import { isDemoSession, withDemoContext } from '../../lib/auth';
import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import { writeAuditLog } from '../../lib/auditLog';
import { getTeacherClassroomScope } from '../../lib/teacherClassrooms';
import type { AppSessionContext } from '../../types/core';

interface ScoresPageProps {
  session: AppSessionContext;
}

type AssessmentCategory = 'quiz' | 'assignment' | 'midterm' | 'final' | 'exam' | 'project' | 'reading' | 'other';
type AssessmentStatus = 'draft' | 'published' | 'archived';
type ScoreBand = 'coursework' | 'midterm' | 'final';
type ScoreView = 'overview' | 'setup' | 'entry' | 'excel' | 'gradebook';
export type ScorePerspective = 'subject' | 'classroom';

const scoreViewValues = ['overview', 'setup', 'entry', 'excel', 'gradebook'] as const;

function isScoreView(value: string | null): value is ScoreView {
  return Boolean(value && scoreViewValues.includes(value as ScoreView));
}

export interface ThaiGradeInfo {
  badgeClass: string;
  grade: string;
  label: string;
}

export function getThaiGrade(percent: number | null | undefined): ThaiGradeInfo {
  if (percent === null || percent === undefined || !Number.isFinite(percent)) {
    return { badgeClass: 'bg-slate-100 text-slate-500 ring-slate-200', grade: '-', label: 'ยังไม่มีคะแนน' };
  }
  if (percent >= 80) return { badgeClass: 'bg-emerald-50 text-emerald-700 ring-emerald-200', grade: '4', label: 'ดีเยี่ยม' };
  if (percent >= 75) return { badgeClass: 'bg-emerald-50 text-emerald-600 ring-emerald-100', grade: '3.5', label: 'ดีมาก' };
  if (percent >= 70) return { badgeClass: 'bg-teal-50 text-teal-700 ring-teal-200', grade: '3', label: 'ดี' };
  if (percent >= 65) return { badgeClass: 'bg-cyan-50 text-cyan-700 ring-cyan-200', grade: '2.5', label: 'ค่อนข้างดี' };
  if (percent >= 60) return { badgeClass: 'bg-blue-50 text-blue-700 ring-blue-200', grade: '2', label: 'ปานกลาง' };
  if (percent >= 55) return { badgeClass: 'bg-amber-50 text-amber-700 ring-amber-200', grade: '1.5', label: 'พอใช้' };
  if (percent >= 50) return { badgeClass: 'bg-orange-50 text-orange-700 ring-orange-200', grade: '1', label: 'ผ่านเกณฑ์ขั้นต่ำ' };
  return { badgeClass: 'bg-rose-50 text-rose-700 ring-rose-200', grade: '0', label: 'ต่ำกว่าเกณฑ์' };
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

interface SafeDeleteResult {
  deleted?: boolean;
  reason?: string;
}

const demoClassrooms: ClassroomRow[] = [
  { academic_year: '2569', id: 'demo-classroom-1', name: 'ป.5/1' },
  { academic_year: '2569', id: 'demo-classroom-2', name: 'ป.5/2' },
];

const demoStudents: StudentRow[] = [
  {
    classroom_id: 'demo-classroom-1',
    first_name: 'ณัฐวุฒิ',
    id: 'demo-student-1',
    last_name: 'ใจดี',
    nickname: 'นัท',
    student_code: '001',
  },
  {
    classroom_id: 'demo-classroom-1',
    first_name: 'พิมพ์ชนก',
    id: 'demo-student-2',
    last_name: 'แสงทอง',
    nickname: 'พิม',
    student_code: '002',
  },
  {
    classroom_id: 'demo-classroom-1',
    first_name: 'กิตติพงศ์',
    id: 'demo-student-3',
    last_name: 'สุขใจ',
    nickname: 'ก้อง',
    student_code: '003',
  },
  {
    classroom_id: 'demo-classroom-2',
    first_name: 'ธนกฤต',
    id: 'demo-student-4',
    last_name: 'มีทรัพย์',
    nickname: 'กฤต',
    student_code: '001',
  },
  {
    classroom_id: 'demo-classroom-2',
    first_name: 'ปภาวดี',
    id: 'demo-student-5',
    last_name: 'ทองแท้',
    nickname: 'วาวา',
    student_code: '002',
  },
  {
    classroom_id: 'demo-classroom-2',
    first_name: 'ชวกร',
    id: 'demo-student-6',
    last_name: 'สมบูรณ์',
    nickname: 'กร',
    student_code: '003',
  },
];

const demoAssessments: ScoreAssessmentRow[] = [
  {
    assessment_date: getBangkokDate(),
    category: 'quiz',
    classroom_id: 'demo-classroom-1',
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
    assessment_date: getBangkokDate(new Date(Date.now() - 1000 * 60 * 60 * 24 * 4)),
    category: 'assignment',
    classroom_id: 'demo-classroom-1',
    created_by: 'demo-teacher',
    id: 'demo-assessment-2',
    max_score: 30,
    status: 'published',
    subject_name: 'ภาษาไทย',
    title: 'อ่านจับใจความ',
    weight: 15,
    workspace_id: 'demo-workspace',
  },
  {
    assessment_date: getBangkokDate(new Date(Date.now() - 1000 * 60 * 60 * 24 * 9)),
    category: 'midterm',
    classroom_id: 'demo-classroom-1',
    created_by: 'demo-teacher',
    id: 'demo-assessment-3',
    max_score: 20,
    status: 'draft',
    subject_name: 'คณิตศาสตร์',
    title: 'สอบกลางภาค',
    weight: 20,
    workspace_id: 'demo-workspace',
  },
  {
    assessment_date: getBangkokDate(new Date(Date.now() - 1000 * 60 * 60 * 24 * 14)),
    category: 'final',
    classroom_id: 'demo-classroom-1',
    created_by: 'demo-teacher',
    id: 'demo-assessment-4',
    max_score: 30,
    status: 'draft',
    subject_name: 'คณิตศาสตร์',
    title: 'สอบปลายภาค',
    weight: 30,
    workspace_id: 'demo-workspace',
  },
  {
    assessment_date: getBangkokDate(),
    category: 'quiz',
    classroom_id: 'demo-classroom-2',
    created_by: 'demo-teacher',
    id: 'demo-assessment-5',
    max_score: 20,
    status: 'draft',
    subject_name: 'คณิตศาสตร์',
    title: 'แบบทดสอบเศษส่วน',
    weight: 10,
    workspace_id: 'demo-workspace',
  },
  {
    assessment_date: getBangkokDate(new Date(Date.now() - 1000 * 60 * 60 * 24 * 9)),
    category: 'midterm',
    classroom_id: 'demo-classroom-2',
    created_by: 'demo-teacher',
    id: 'demo-assessment-6',
    max_score: 20,
    status: 'draft',
    subject_name: 'คณิตศาสตร์',
    title: 'สอบกลางภาค',
    weight: 20,
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
  { assessment_id: 'demo-assessment-3', id: 'demo-entry-7', note: null, score: 17, student_id: 'demo-student-1' },
  { assessment_id: 'demo-assessment-3', id: 'demo-entry-8', note: null, score: 13, student_id: 'demo-student-2' },
  { assessment_id: 'demo-assessment-3', id: 'demo-entry-9', note: null, score: 15, student_id: 'demo-student-3' },
  { assessment_id: 'demo-assessment-5', id: 'demo-entry-10', note: null, score: 19, student_id: 'demo-student-4' },
  { assessment_id: 'demo-assessment-5', id: 'demo-entry-11', note: null, score: 15, student_id: 'demo-student-5' },
  { assessment_id: 'demo-assessment-5', id: 'demo-entry-12', note: null, score: 17, student_id: 'demo-student-6' },
  { assessment_id: 'demo-assessment-6', id: 'demo-entry-13', note: null, score: 18, student_id: 'demo-student-4' },
  { assessment_id: 'demo-assessment-6', id: 'demo-entry-14', note: null, score: 14, student_id: 'demo-student-5' },
  { assessment_id: 'demo-assessment-6', id: 'demo-entry-15', note: null, score: 16, student_id: 'demo-student-6' },
];

const categoryOptions: Array<{ label: string; value: AssessmentCategory }> = [
  { label: 'แบบทดสอบ', value: 'quiz' },
  { label: 'งาน/ใบงาน', value: 'assignment' },
  { label: 'กลางภาค', value: 'midterm' },
  { label: 'ปลายภาค', value: 'final' },
  { label: 'สอบ', value: 'exam' },
  { label: 'โครงงาน', value: 'project' },
  { label: 'อ่านเขียน', value: 'reading' },
  { label: 'อื่นๆ', value: 'other' },
];

const categoryLabels = Object.fromEntries(categoryOptions.map((option) => [option.value, option.label])) as Record<
  AssessmentCategory,
  string
>;

const scoreBandConfigs: Array<{
  description: string;
  key: ScoreBand;
  label: string;
  recommendedWeight: number;
}> = [
  { description: 'เก็บคะแนนย่อย ใบงาน โครงงาน และกิจกรรมระหว่างเรียน', key: 'coursework', label: 'ระหว่างเรียน', recommendedWeight: 50 },
  { description: 'คะแนนสอบกลางภาคของรายวิชานี้', key: 'midterm', label: 'กลางภาค', recommendedWeight: 20 },
  { description: 'คะแนนสอบปลายภาคของรายวิชานี้', key: 'final', label: 'ปลายภาค', recommendedWeight: 30 },
];

function getScoreBand(category: AssessmentCategory): ScoreBand {
  if (category === 'midterm') return 'midterm';
  if (category === 'final') return 'final';
  return 'coursework';
}

function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function getTodayDate() {
  return getBangkokDate();
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

function isMissingScoreDeleteRpc(error: { code?: string; message?: string }) {
  const message = error.message || '';
  return (
    error.code === 'PGRST202' ||
    message.includes('schema cache') ||
    message.includes('Could not find the function') ||
    message.includes('delete_score_assessment_safely') ||
    message.includes('delete_score_entry_safely')
  );
}

function getScoreDeleteErrorMessage(actionLabel: string, error: { code?: string; message?: string }) {
  const message = error.message || 'ไม่ทราบสาเหตุ';

  if (isMissingScoreDeleteRpc(error)) {
    return `${actionLabel}ไม่สำเร็จ: Supabase project ยังไม่มี RPC ลบคะแนนชุดล่าสุด ให้รัน supabase/migrations/0020_harden_destructive_action_rpcs.sql ใน SQL Editor แล้ว reload schema cache ก่อนลองใหม่`;
  }

  if (error.code === '42501' || message.includes('not allowed')) {
    return `${actionLabel}ไม่สำเร็จ: บัญชีนี้ต้องเป็นเจ้าของ workspace, ครูร่วม หรือ Superadmin`;
  }

  return `${actionLabel}ไม่สำเร็จ: ${message}`;
}

function getClassroomWithRoster(
  classrooms: ClassroomRow[],
  students: StudentRow[],
  assessments: ScoreAssessmentRow[] = [],
  preferredHomeroomId?: string,
) {
  if (preferredHomeroomId && classrooms.some((classroom) => classroom.id === preferredHomeroomId)) {
    return preferredHomeroomId;
  }
  const classroomWithStudents = classrooms.find((classroom) =>
    students.some((student) => student.classroom_id === classroom.id),
  );
  const classroomWithAssessment = classrooms.find((classroom) =>
    assessments.some((assessment) => assessment.classroom_id === classroom.id && assessment.status !== 'archived'),
  );

  return classroomWithStudents?.id || classroomWithAssessment?.id || classrooms[0]?.id || '';
}

export function ScoresPage({ session }: ScoresPageProps) {
  const demoMode = isDemoSession(session);
  const location = useLocation();
  const navigate = useNavigate();
  const requestedScoreView = new URLSearchParams(location.search).get('scoreView');
  const initialScoreView = isScoreView(requestedScoreView) ? requestedScoreView : 'excel';
  const requestedPerspective = new URLSearchParams(location.search).get('perspective');
  const initialPerspective: ScorePerspective = requestedPerspective === 'classroom' ? 'classroom' : 'subject';

  const [perspective, setPerspective] = useState<ScorePerspective>(initialPerspective);
  const [subjectSubView, setSubjectSubView] = useState<'grid' | 'comparison'>('grid');
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [cloneSourceClassroomId, setCloneSourceClassroomId] = useState('');
  const [cloneTargetClassroomIds, setCloneTargetClassroomIds] = useState<string[]>([]);

  const [classrooms, setClassrooms] = useState<ClassroomRow[]>(demoClassrooms);
  const [students, setStudents] = useState<StudentRow[]>(demoStudents);
  const [assessments, setAssessments] = useState<ScoreAssessmentRow[]>(demoAssessments);
  const [entries, setEntries] = useState<ScoreEntryRow[]>(demoEntries);
  const [classroomId, setClassroomId] = useState(demoClassrooms[0].id);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState(demoAssessments[0].id);
  const [subjectFilter, setSubjectFilter] = useState(demoAssessments[0].subject_name);
  const [scoreView, setScoreView] = useState<ScoreView>(initialScoreView);
  const [searchTerm, setSearchTerm] = useState('');
  const [scores, setScores] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [correctedAssessmentDate, setCorrectedAssessmentDate] = useState('');
  const [isLoading, setIsLoading] = useState(Boolean(supabase && session.workspace));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(
    isSupabaseReady ? null : 'โหมดตัวอย่าง: ตั้งค่า .env.local และรัน migration เพื่อบันทึกคะแนนลง Supabaseจริง',
  );
  const [form, setForm] = useState({
    assessmentDate: getTodayDate(),
    category: 'quiz' as AssessmentCategory,
    maxScore: '20',
    subjectName: 'คณิตศาสตร์',
    targetClassroomIds: [] as string[],
    title: '',
    weight: '10',
  });
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(true);

  const teacherScope = useMemo(
    () => getTeacherClassroomScope(session, classrooms),
    [session, classrooms],
  );

  useEffect(() => {
    const nextScoreView = isScoreView(requestedScoreView) ? requestedScoreView : 'excel';
    if (nextScoreView !== scoreView) {
      setScoreView(nextScoreView);
    }
  }, [requestedScoreView, scoreView]);

  function handleScoreViewChange(nextScoreView: ScoreView) {
    setScoreView(nextScoreView);
    navigate(withDemoContext(`/app/dashboard?view=scores&scoreView=${nextScoreView}&perspective=${perspective}`, location.search), { replace: true });
  }

  function handlePerspectiveChange(nextPerspective: ScorePerspective) {
    setPerspective(nextPerspective);
    const params = new URLSearchParams(location.search);
    params.set('perspective', nextPerspective);
    if (!params.get('scoreView')) {
      params.set('scoreView', scoreView);
    }
    navigate(withDemoContext(`/app/dashboard?${params.toString()}`, location.search), { replace: true });
  }

  const classroomStudents = useMemo(
    () => students.filter((student) => student.classroom_id === classroomId),
    [classroomId, students],
  );

  const classroomById = useMemo(() => new Map(classrooms.map((classroom) => [classroom.id, classroom])), [classrooms]);

  const activeClassroom = useMemo(() => classroomById.get(classroomId) || classrooms[0] || null, [
    classroomById,
    classroomId,
    classrooms,
  ]);

  const classroomAssessments = useMemo(
    () =>
      assessments
        .filter((assessment) => assessment.classroom_id === classroomId && assessment.status !== 'archived')
        .sort((a, b) => b.assessment_date.localeCompare(a.assessment_date)),
    [assessments, classroomId],
  );

  const allWorkspaceSubjects = useMemo(() => {
    const list = assessments
      .filter((a) => a.status !== 'archived')
      .map((a) => a.subject_name.trim())
      .filter(Boolean);
    if (form.subjectName.trim()) list.push(form.subjectName.trim());
    return Array.from(new Set(list)).sort((a, b) => a.localeCompare(b, 'th'));
  }, [assessments, form.subjectName]);

  const classroomsWithSubject = useMemo(() => {
    if (!subjectFilter) return classrooms;
    const matchIds = new Set(
      assessments
        .filter((a) => a.status !== 'archived' && a.subject_name.trim().toLowerCase() === subjectFilter.trim().toLowerCase())
        .map((a) => a.classroom_id),
    );
    const matched = classrooms.filter((c) => matchIds.has(c.id));
    return matched.length > 0 ? matched : classrooms;
  }, [assessments, classrooms, subjectFilter]);

  const availableClassroomsToAdd = useMemo(() => {
    const currentIds = new Set(classroomsWithSubject.map((c) => c.id));
    return classrooms.filter((c) => !currentIds.has(c.id));
  }, [classrooms, classroomsWithSubject]);

  const nextClassroom = useMemo(() => {
    if (perspective !== 'subject') return null;
    const idx = classroomsWithSubject.findIndex((c) => c.id === classroomId);
    if (idx >= 0 && idx < classroomsWithSubject.length - 1) {
      return classroomsWithSubject[idx + 1];
    }
    return null;
  }, [perspective, classroomsWithSubject, classroomId]);

  const subjectOptions = useMemo(() => {
    if (perspective === 'subject') {
      return allWorkspaceSubjects.length > 0 ? allWorkspaceSubjects : [form.subjectName.trim() || 'คณิตศาสตร์'];
    }
    const subjects = classroomAssessments.map((assessment) => assessment.subject_name.trim()).filter(Boolean);
    const currentSubject = form.subjectName.trim();
    if (currentSubject) subjects.push(currentSubject);
    return Array.from(new Set(subjects)).sort((a, b) => a.localeCompare(b, 'th'));
  }, [allWorkspaceSubjects, classroomAssessments, form.subjectName, perspective]);

  const contextAssessments = useMemo(
    () =>
      classroomAssessments.filter(
        (assessment) => !subjectFilter || assessment.subject_name.trim() === subjectFilter.trim(),
      ),
    [classroomAssessments, subjectFilter],
  );

  const selectedAssessment = useMemo(
    () => contextAssessments.find((assessment) => assessment.id === selectedAssessmentId) || contextAssessments[0] || null,
    [contextAssessments, selectedAssessmentId],
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

  const unsavedCount = useMemo(() => {
    if (!selectedAssessment) return 0;
    let count = 0;
    classroomStudents.forEach((student) => {
      const entry = selectedEntryByStudent.get(student.id);
      const savedScore = entry?.score === null || entry?.score === undefined ? '' : String(entry.score);
      const currentScore = scores[student.id] ?? savedScore;
      const savedNote = entry?.note || '';
      const currentNote = notes[student.id] ?? savedNote;
      if (currentScore !== savedScore || currentNote !== savedNote) {
        count += 1;
      }
    });
    return count;
  }, [classroomStudents, notes, scores, selectedAssessment, selectedEntryByStudent]);

  const entriesByAssessment = useMemo(() => {
    const entryMap = new Map<string, ScoreEntryRow[]>();
    entries.forEach((entry) => {
      const current = entryMap.get(entry.assessment_id) || [];
      current.push(entry);
      entryMap.set(entry.assessment_id, current);
    });
    return entryMap;
  }, [entries]);

  const scoreContexts = useMemo(() => {
    const contextMap = new Map<
      string,
      {
        assessmentCount: number;
        classroomId: string;
        classroomName: string;
        latestDate: string;
        scoredEntries: number;
        studentCount: number;
        subjectName: string;
        totalPercent: number;
      }
    >();

    assessments
      .filter((assessment) => assessment.status !== 'archived')
      .forEach((assessment) => {
        const key = `${assessment.classroom_id}::${assessment.subject_name}`;
        const assessmentEntries = (entriesByAssessment.get(assessment.id) || []).filter((entry) => entry.score !== null);
        const averagePercent =
          assessmentEntries.length > 0
            ? assessmentEntries.reduce((sum, entry) => sum + ((entry.score || 0) / assessment.max_score) * 100, 0) /
              assessmentEntries.length
            : 0;
        const studentCount = students.filter((student) => student.classroom_id === assessment.classroom_id).length;
        const current =
          contextMap.get(key) || {
            assessmentCount: 0,
            classroomId: assessment.classroom_id,
            classroomName: classroomById.get(assessment.classroom_id)?.name || 'ไม่ทราบห้อง',
            latestDate: assessment.assessment_date,
            scoredEntries: 0,
            studentCount,
            subjectName: assessment.subject_name,
            totalPercent: 0,
          };

        contextMap.set(key, {
          ...current,
          assessmentCount: current.assessmentCount + 1,
          latestDate:
            assessment.assessment_date.localeCompare(current.latestDate) > 0 ? assessment.assessment_date : current.latestDate,
          scoredEntries: current.scoredEntries + assessmentEntries.length,
          totalPercent: current.totalPercent + averagePercent,
        });
      });

    return Array.from(contextMap.values())
      .map((context) => {
        const expectedEntries = context.assessmentCount * context.studentCount;
        return {
          ...context,
          averagePercent: context.assessmentCount > 0 ? context.totalPercent / context.assessmentCount : 0,
          completePercent: expectedEntries > 0 ? Math.round((context.scoredEntries / expectedEntries) * 100) : 0,
          expectedEntries,
        };
      })
      .sort((a, b) => b.latestDate.localeCompare(a.latestDate));
  }, [assessments, classroomById, entriesByAssessment, students]);

  const currentContext = useMemo(
    () =>
      scoreContexts.find(
        (context) => context.classroomId === classroomId && (!subjectFilter || context.subjectName === subjectFilter),
      ) || null,
    [classroomId, scoreContexts, subjectFilter],
  );

  const lowScoreStudents = useMemo(() => {
    if (!selectedAssessment) return [];

    return classroomStudents
      .map((student) => {
        const entry = selectedEntryByStudent.get(student.id);
        const rawScore = scores[student.id];
        const score = rawScore === undefined || rawScore === '' ? entry?.score ?? null : Number(rawScore);
        const percent =
          score === null || !Number.isFinite(score)
            ? null
            : Math.round((score / selectedAssessment.max_score) * 10000) / 100;
        return { percent, score, student };
      })
      .filter((row) => row.percent !== null && row.percent < 50)
      .sort((a, b) => (a.percent || 0) - (b.percent || 0));
  }, [classroomStudents, scores, selectedAssessment, selectedEntryByStudent]);

  const overallStats = useMemo(() => {
    const activeAssessments = assessments.filter((assessment) => assessment.status !== 'archived');
    const filledEntries = entries.filter((entry) => entry.score !== null).length;
    const expectedEntries = activeAssessments.reduce(
      (sum, assessment) => sum + students.filter((student) => student.classroom_id === assessment.classroom_id).length,
      0,
    );
    const activeSubjects = new Set(activeAssessments.map((assessment) => assessment.subject_name)).size;

    return {
      activeSubjects,
      assessmentCount: activeAssessments.length,
      completePercent: expectedEntries > 0 ? Math.round((filledEntries / expectedEntries) * 100) : 0,
      contextCount: scoreContexts.length,
    };
  }, [assessments, entries, scoreContexts.length, students]);

  const crossClassroomStats = useMemo(() => {
    if (!subjectFilter) return [];
    return classroomsWithSubject.map((c) => {
      const cStudents = students.filter((s) => s.classroom_id === c.id);
      const cAssessments = assessments.filter(
        (a) =>
          a.classroom_id === c.id &&
          a.status !== 'archived' &&
          a.subject_name.trim().toLowerCase() === subjectFilter.trim().toLowerCase(),
      );
      const cAssessmentIds = new Set(cAssessments.map((a) => a.id));
      const cEntries = entries.filter((e) => cAssessmentIds.has(e.assessment_id) && e.score !== null);
      const expected = cStudents.length * cAssessments.length;
      const completionPercent = expected > 0 ? Math.round((cEntries.length / expected) * 100) : 0;

      const studentPercents = cStudents
        .map((student) => {
          let earned = 0;
          let planned = 0;
          cAssessments.forEach((assessment) => {
            planned += assessment.weight;
            const entry = cEntries.find((e) => e.assessment_id === assessment.id && e.student_id === student.id);
            if (entry?.score !== null && entry?.score !== undefined) {
              earned += (entry.score / assessment.max_score) * assessment.weight;
            }
          });
          return planned > 0 ? (earned / planned) * 100 : null;
        })
        .filter((p): p is number => p !== null);

      const averagePercent =
        studentPercents.length > 0 ? studentPercents.reduce((sum, p) => sum + p, 0) / studentPercents.length : 0;

      const passingCount = studentPercents.filter((p) => p >= 50).length;
      const passingRate = studentPercents.length > 0 ? Math.round((passingCount / studentPercents.length) * 100) : 0;

      const gradeCounts = {
        g4: studentPercents.filter((p) => p >= 80).length,
        g3: studentPercents.filter((p) => p >= 70 && p < 80).length,
        g2: studentPercents.filter((p) => p >= 60 && p < 70).length,
        g1: studentPercents.filter((p) => p >= 50 && p < 60).length,
        g0: studentPercents.filter((p) => p < 50).length,
      };

      return {
        assessmentCount: cAssessments.length,
        averagePercent,
        classroom: c,
        completionPercent,
        gradeCounts,
        passingCount,
        passingRate,
        studentCount: cStudents.length,
      };
    });
  }, [assessments, classroomsWithSubject, entries, students, subjectFilter]);

  const overallSubjectStats = useMemo(() => {
    const totalStudents = crossClassroomStats.reduce((sum, row) => sum + row.studentCount, 0);
    const totalAssessments = crossClassroomStats.reduce((sum, row) => sum + row.assessmentCount, 0);
    const totalPassed = crossClassroomStats.reduce((sum, row) => sum + row.passingCount, 0);
    const avgPercent =
      crossClassroomStats.length > 0
        ? crossClassroomStats.reduce((sum, row) => sum + row.averagePercent, 0) / crossClassroomStats.length
        : 0;
    const avgCompletion =
      crossClassroomStats.length > 0
        ? Math.round(crossClassroomStats.reduce((sum, row) => sum + row.completionPercent, 0) / crossClassroomStats.length)
        : 0;
    return {
      avgCompletion,
      avgPercent,
      classroomCount: crossClassroomStats.length,
      overallPassingRate: totalStudents > 0 ? Math.round((totalPassed / totalStudents) * 100) : 0,
      totalAssessments,
      totalStudents,
    };
  }, [crossClassroomStats]);

  const scoreBandSummaries = useMemo(
    () =>
      scoreBandConfigs.map((band) => {
        const bandAssessments = contextAssessments.filter((assessment) => getScoreBand(assessment.category) === band.key);
        const plannedWeight = bandAssessments.reduce((sum, assessment) => sum + assessment.weight, 0);
        const expectedEntries = bandAssessments.length * classroomStudents.length;
        const scoredEntries = bandAssessments.reduce(
          (sum, assessment) =>
            sum + (entriesByAssessment.get(assessment.id) || []).filter((entry) => entry.score !== null).length,
          0,
        );
        const averagePercent =
          bandAssessments.length > 0
            ? bandAssessments.reduce((sum, assessment) => {
                const assessmentEntries = (entriesByAssessment.get(assessment.id) || []).filter(
                  (entry) => entry.score !== null,
                );
                if (assessmentEntries.length === 0) return sum;
                return (
                  sum +
                  assessmentEntries.reduce((entrySum, entry) => entrySum + ((entry.score || 0) / assessment.max_score) * 100, 0) /
                    assessmentEntries.length
                );
              }, 0) / bandAssessments.length
            : 0;

        return {
          ...band,
          assessmentCount: bandAssessments.length,
          averagePercent,
          completePercent: expectedEntries > 0 ? Math.round((scoredEntries / expectedEntries) * 100) : 0,
          plannedWeight,
        };
      }),
    [classroomStudents.length, contextAssessments, entriesByAssessment],
  );

  const plannedTotalWeight = useMemo(
    () => contextAssessments.reduce((sum, assessment) => sum + assessment.weight, 0),
    [contextAssessments],
  );

  const studentGradebookRows = useMemo(
    () =>
      classroomStudents.map((student) => {
        const bandScores = Object.fromEntries(
          scoreBandConfigs.map((band) => [
            band.key,
            {
              earnedWeight: 0,
              enteredWeight: 0,
              plannedWeight: 0,
            },
          ]),
        ) as Record<ScoreBand, { earnedWeight: number; enteredWeight: number; plannedWeight: number }>;

        contextAssessments.forEach((assessment) => {
          const band = getScoreBand(assessment.category);
          const entry = (entriesByAssessment.get(assessment.id) || []).find((row) => row.student_id === student.id);
          bandScores[band].plannedWeight += assessment.weight;

          if (entry?.score !== null && entry?.score !== undefined) {
            bandScores[band].enteredWeight += assessment.weight;
            bandScores[band].earnedWeight += (entry.score / assessment.max_score) * assessment.weight;
          }
        });

        const earnedTotal = scoreBandConfigs.reduce((sum, band) => sum + bandScores[band.key].earnedWeight, 0);
        const enteredWeight = scoreBandConfigs.reduce((sum, band) => sum + bandScores[band.key].enteredWeight, 0);
        const plannedWeight = scoreBandConfigs.reduce((sum, band) => sum + bandScores[band.key].plannedWeight, 0);

        return {
          bandScores,
          completionPercent: plannedWeight > 0 ? Math.round((enteredWeight / plannedWeight) * 100) : 0,
          earnedTotal,
          finalPercent: plannedWeight > 0 ? (earnedTotal / plannedWeight) * 100 : 0,
          plannedWeight,
          student,
        };
      }),
    [classroomStudents, contextAssessments, entriesByAssessment],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadBaseData() {
      if (!supabase || !session.workspace || demoMode) {
        setClassrooms(demoClassrooms);
        setStudents(demoStudents);
        setAssessments(demoAssessments);
        setEntries(demoEntries);
        setClassroomId(demoClassrooms[0].id);
        setSubjectFilter(demoAssessments[0].subject_name);
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
      const initialScope = getTeacherClassroomScope(session, nextClassrooms);
      const preferredHomeroomId = initialScope.hasHomeroom ? initialScope.homeroomClassrooms[0].id : undefined;
      const nextClassroomId = getClassroomWithRoster(nextClassrooms, nextStudents, nextAssessments, preferredHomeroomId);
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
      setSubjectFilter(nextAssessments.find((assessment) => assessment.id === nextSelectedAssessmentId)?.subject_name || '');
      setSelectedAssessmentId(nextSelectedAssessmentId);
      setIsLoading(false);
    }

    void loadBaseData();

    return () => {
      isMounted = false;
    };
  }, [demoMode, session.profile.id, session.workspace]);

  useEffect(() => {
    if (subjectOptions.length > 0 && (!subjectFilter || !subjectOptions.includes(subjectFilter))) {
      setSubjectFilter(subjectOptions[0]);
      return;
    }

    if (!selectedAssessment && contextAssessments[0]) {
      setSelectedAssessmentId(contextAssessments[0].id);
    }
  }, [contextAssessments, selectedAssessment, subjectFilter, subjectOptions]);

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

    const targetIds = form.targetClassroomIds.length > 0 ? form.targetClassroomIds : [classroomId];
    if (targetIds.length === 0) {
      setNotice('กรุณาเลือกอย่างน้อย 1 ห้องเรียน');
      setIsSubmitting(false);
      return;
    }

    if (!title || !subjectName) {
      setNotice('กรุณากรอกชื่อชุดคะแนนและวิชา');
      setIsSubmitting(false);
      return;
    }

    if (!supabase || !session.workspace || isDemoSession(session)) {
      const newItems: ScoreAssessmentRow[] = targetIds.map((cid, idx) => ({
        assessment_date: form.assessmentDate,
        category: form.category,
        classroom_id: cid,
        created_by: session.profile.id,
        id: `demo-assessment-${Date.now()}-${idx}`,
        max_score: maxScore,
        status: 'draft',
        subject_name: subjectName,
        title,
        weight,
        workspace_id: session.workspace?.id || 'demo-workspace',
      }));

      setAssessments((current) => [...newItems, ...current]);
      setSubjectFilter(subjectName);
      setSelectedAssessmentId(newItems[0].id);
      setForm((current) => ({ ...current, targetClassroomIds: [], title: '' }));
      setIsCreateModalOpen(false);
      handleScoreViewChange('entry');
      setNotice(`สร้างชุดคะแนนในโหมดตัวอย่างแล้ว (${newItems.length} ห้องเรียน)`);
      setIsSubmitting(false);
      return;
    }

    const workspaceId = session.workspace.id;
    const payload = targetIds.map((cid) => ({
      assessment_date: form.assessmentDate,
      category: form.category,
      classroom_id: cid,
      created_by: session.profile.id,
      max_score: maxScore,
      status: 'draft' as AssessmentStatus,
      subject_name: subjectName,
      title,
      weight,
      workspace_id: workspaceId,
    }));

    const { data, error } = await supabase
      .from('score_assessments')
      .insert(payload)
      .select('id,workspace_id,classroom_id,title,subject_name,category,max_score,weight,assessment_date,status,created_by');

    if (error) {
      setNotice(error.message);
      setIsSubmitting(false);
      return;
    }

    const createdList = (data || []) as ScoreAssessmentRow[];
    await writeAuditLog(session, {
      action: 'score_assessment.batch_created',
      entityId: createdList[0]?.id || '',
      entityTable: 'score_assessments',
      metadata: {
        category: form.category,
        classrooms_count: createdList.length,
        max_score: maxScore,
        subject_name: subjectName,
        title,
      },
      riskLevel: 'low',
      source: 'score_center',
    });

    setAssessments((current) => [...createdList, ...current]);
    setSubjectFilter(subjectName);
    if (createdList[0]) setSelectedAssessmentId(createdList[0].id);
    setForm((current) => ({ ...current, targetClassroomIds: [], title: '' }));
    setIsCreateModalOpen(false);
    handleScoreViewChange('entry');
    setNotice(`สร้างชุดคะแนนแล้ว (${createdList.length} ห้องเรียน)`);
    setIsSubmitting(false);
  }

  async function handleCloneStructure() {
    if (!cloneSourceClassroomId || cloneTargetClassroomIds.length === 0 || !subjectFilter) {
      setNotice('กรุณาเลือกห้องต้นแบบและห้องปลายทางที่ต้องการคัดลอก');
      return;
    }
    setIsSubmitting(true);
    setNotice(null);

    const sourceAssessments = assessments.filter(
      (a) =>
        a.classroom_id === cloneSourceClassroomId &&
        a.status !== 'archived' &&
        a.subject_name.trim().toLowerCase() === subjectFilter.trim().toLowerCase(),
    );

    if (sourceAssessments.length === 0) {
      setNotice('ห้องต้นแบบยังไม่มีชุดคะแนนในวิชานี้');
      setIsSubmitting(false);
      return;
    }

    const itemsToCreate: Array<Omit<ScoreAssessmentRow, 'id'> & { id?: string }> = [];

    cloneTargetClassroomIds.forEach((targetCid) => {
      const existingTitles = new Set(
        assessments
          .filter(
            (a) =>
              a.classroom_id === targetCid &&
              a.status !== 'archived' &&
              a.subject_name.trim().toLowerCase() === subjectFilter.trim().toLowerCase(),
          )
          .map((a) => a.title.trim().toLowerCase()),
      );

      sourceAssessments.forEach((source) => {
        if (!existingTitles.has(source.title.trim().toLowerCase())) {
          itemsToCreate.push({
            assessment_date: source.assessment_date,
            category: source.category,
            classroom_id: targetCid,
            created_by: session.profile?.id || null,
            max_score: source.max_score,
            status: 'draft',
            subject_name: source.subject_name,
            title: source.title,
            weight: source.weight,
            workspace_id: session.workspace?.id || 'demo-workspace',
          });
        }
      });
    });

    if (itemsToCreate.length === 0) {
      setNotice('ทุกห้องปลายทางมีชุดคะแนนเหล่านี้อยู่แล้ว');
      setIsSubmitting(false);
      setIsCloneModalOpen(false);
      return;
    }

    if (!supabase || !session.workspace || isDemoSession(session)) {
      const created: ScoreAssessmentRow[] = itemsToCreate.map((item, idx) => ({
        ...item,
        id: `demo-cloned-${Date.now()}-${idx}`,
      }));
      setAssessments((current) => [...created, ...current]);
      setIsCloneModalOpen(false);
      setIsSubmitting(false);
      setNotice(
        `คัดลอกโครงสร้างคะแนนสำเร็จ: สร้างชุดคะแนน ${created.length} รายการให้ ${cloneTargetClassroomIds.length} ห้องเรียน [โหมดตัวอย่าง]`,
      );
      return;
    }

    const { data, error } = await supabase
      .from('score_assessments')
      .insert(
        itemsToCreate.map((item) => ({
          assessment_date: item.assessment_date,
          category: item.category,
          classroom_id: item.classroom_id,
          created_by: item.created_by,
          max_score: item.max_score,
          status: item.status,
          subject_name: item.subject_name,
          title: item.title,
          weight: item.weight,
          workspace_id: item.workspace_id,
        })),
      )
      .select('id,workspace_id,classroom_id,title,subject_name,category,max_score,weight,assessment_date,status,created_by');

    if (error) {
      setNotice(error.message);
      setIsSubmitting(false);
      return;
    }

    const created = (data || []) as ScoreAssessmentRow[];
    setAssessments((current) => [...created, ...current]);
    setIsCloneModalOpen(false);
    setIsSubmitting(false);
    setNotice(
      `คัดลอกโครงสร้างคะแนนสำเร็จ: สร้างชุดคะแนน ${created.length} รายการให้ ${cloneTargetClassroomIds.length} ห้องเรียน`,
    );
  }

  function handleFillAllMaxScore() {
    if (!selectedAssessment) return;
    const maxStr = String(selectedAssessment.max_score);
    const nextScores: Record<string, string> = {};
    classroomStudents.forEach((student) => {
      nextScores[student.id] = maxStr;
    });
    setScores((current) => ({ ...current, ...nextScores }));
    setNotice(`ใส่คะแนนเต็ม (${selectedAssessment.max_score}) ให้ทุกคน (${classroomStudents.length} คน) เรียบร้อย อย่าลืมกดบันทึกคะแนน`);
  }

  function handleResetUnsaved() {
    if (!selectedAssessment) return;
    const originalScores: Record<string, string> = {};
    const originalNotes: Record<string, string> = {};
    selectedEntries.forEach((entry) => {
      originalScores[entry.student_id] = entry.score === null || entry.score === undefined ? '' : String(entry.score);
      originalNotes[entry.student_id] = entry.note || '';
    });
    setScores(originalScores);
    setNotes(originalNotes);
    setNotice('ยกเลิกการแก้ไขที่ยังไม่ได้บันทึกแล้ว');
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

    if (!supabase || isDemoSession(session)) {
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

    if (!supabase || isDemoSession(session)) {
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

  async function handleCorrectAssessmentDate() {
    if (!selectedAssessment || !correctedAssessmentDate || correctedAssessmentDate === selectedAssessment.assessment_date) return;
    setIsSubmitting(true);
    setNotice(null);
    if (!supabase || !session.workspace || isDemoSession(session)) {
      setAssessments((current) => current.map((item) => item.id === selectedAssessment.id ? { ...item, assessment_date: correctedAssessmentDate } : item));
      setNotice('แก้ไขวันที่ชุดคะแนนในโหมดตัวอย่างแล้ว');
      setIsSubmitting(false);
      return;
    }
    const { error } = await supabase
      .from('score_assessments')
      .update({ assessment_date: correctedAssessmentDate })
      .eq('id', selectedAssessment.id)
      .eq('workspace_id', session.workspace.id);
    if (error) {
      setNotice(error.message);
      setIsSubmitting(false);
      return;
    }
    await writeAuditLog(session, {
      action: 'score_assessment.date_corrected',
      entityId: selectedAssessment.id,
      entityTable: 'score_assessments',
      metadata: { from_date: selectedAssessment.assessment_date, to_date: correctedAssessmentDate },
      riskLevel: 'normal',
      source: 'score_center',
    });
    setAssessments((current) => current.map((item) => item.id === selectedAssessment.id ? { ...item, assessment_date: correctedAssessmentDate } : item));
    setNotice('แก้ไขวันที่ชุดคะแนนแล้ว รายงานจะอ้างอิงวันที่ใหม่');
    setIsSubmitting(false);
  }

  function removeAssessmentFromLocalState(assessmentId: string) {
    setAssessments((current) => current.filter((item) => item.id !== assessmentId));
    setEntries((current) => current.filter((entry) => entry.assessment_id !== assessmentId));
    setScores({});
    setNotes({});

    if (selectedAssessmentId === assessmentId) {
      const nextAssessment = contextAssessments.find((item) => item.id !== assessmentId) || null;
      setSelectedAssessmentId(nextAssessment?.id || '');
    }
  }

  async function handleDeleteAssessment(assessment: ScoreAssessmentRow) {
    const assessmentEntries = entriesByAssessment.get(assessment.id) || [];
    const confirmed = window.confirm(
      `ลบชุดคะแนน "${assessment.title}" ถาวรหรือไม่?\n\nคะแนนที่กรอกไว้ ${assessmentEntries.length} รายการจะถูกลบไปพร้อมกัน และจะหายจากรายงานคะแนน`,
    );
    if (!confirmed) return;

    setIsSubmitting(true);
    setNotice(null);

    if (!supabase || isDemoSession(session)) {
      removeAssessmentFromLocalState(assessment.id);
      setNotice('ลบชุดคะแนนในโหมดตัวอย่างแล้ว');
      setIsSubmitting(false);
      return;
    }

    const rpcResult = await supabase.rpc('delete_score_assessment_safely', {
      target_assessment_id: assessment.id,
    });

    if (rpcResult.error) {
      setNotice(getScoreDeleteErrorMessage('ลบชุดคะแนน', rpcResult.error));
      setIsSubmitting(false);
      return;
    }

    const result = rpcResult.data as SafeDeleteResult | null;
    if (!result?.deleted) {
      setNotice(
        `ลบชุดคะแนนไม่สำเร็จ: ฐานข้อมูลไม่ได้ลบแถวจริง${result?.reason ? ` (${result.reason})` : ''} ถ้า production ยังไม่ได้รัน supabase/migrations/0020_harden_destructive_action_rpcs.sql ให้รันก่อน`,
      );
      setIsSubmitting(false);
      return;
    }

    await writeAuditLog(session, {
      action: 'score_assessment.deleted',
      entityId: assessment.id,
      entityTable: 'score_assessments',
      metadata: {
        category: assessment.category,
        classroom_id: assessment.classroom_id,
        deleted_entries: assessmentEntries.length,
        subject_name: assessment.subject_name,
        title: assessment.title,
      },
      riskLevel: 'high',
      source: 'score_center',
    });

    removeAssessmentFromLocalState(assessment.id);
    setNotice(`ลบชุดคะแนน ${assessment.title} แล้ว`);
    setIsSubmitting(false);
  }

  async function handleClearStudentScore(student: StudentRow) {
    if (!selectedAssessment) return;
    const entry = selectedEntryByStudent.get(student.id);
    const label = `${student.first_name} ${student.last_name}`;
    const confirmed = window.confirm(`ล้างคะแนนของ ${label} ในชุด "${selectedAssessment.title}" หรือไม่?`);
    if (!confirmed) return;

    setNotice(null);
    setScores((current) => ({ ...current, [student.id]: '' }));
    setNotes((current) => ({ ...current, [student.id]: '' }));

    if (!entry?.id) {
      setNotice(`ล้างคะแนนของ ${label} แล้ว`);
      return;
    }

    setIsSubmitting(true);

    if (!supabase || isDemoSession(session)) {
      setEntries((current) => current.filter((item) => item.id !== entry.id));
      setNotice(`ล้างคะแนนของ ${label} ในโหมดตัวอย่างแล้ว`);
      setIsSubmitting(false);
      return;
    }

    const rpcResult = await supabase.rpc('delete_score_entry_safely', {
      target_entry_id: entry.id,
    });

    if (rpcResult.error) {
      setNotice(getScoreDeleteErrorMessage('ล้างคะแนนรายคน', rpcResult.error));
      setScores((current) => ({ ...current, [student.id]: entry.score === null ? '' : String(entry.score) }));
      setNotes((current) => ({ ...current, [student.id]: entry.note || '' }));
      setIsSubmitting(false);
      return;
    }

    const result = rpcResult.data as SafeDeleteResult | null;
    if (!result?.deleted) {
      setNotice('ล้างคะแนนรายคนไม่สำเร็จ: ฐานข้อมูลไม่ได้ลบแถวจริง');
      setIsSubmitting(false);
      return;
    }

    await writeAuditLog(session, {
      action: 'score_entry.deleted',
      entityId: entry.id,
      entityTable: 'score_entries',
      metadata: {
        assessment_id: selectedAssessment.id,
        classroom_id: selectedAssessment.classroom_id,
        student_id: student.id,
        subject_name: selectedAssessment.subject_name,
      },
      riskLevel: 'normal',
      source: 'score_center',
    });

    setEntries((current) => current.filter((item) => item.id !== entry.id));
    setNotice(`ล้างคะแนนของ ${label} แล้ว`);
    setIsSubmitting(false);
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

  // Excel Grid state: key is `${studentId}::${assessmentId}`, value is string
  const [gridScores, setGridScores] = useState<Record<string, string>>({});

  // Initialize or synchronize gridScores when entries change
  useEffect(() => {
    const next: Record<string, string> = {};
    contextAssessments.forEach((assessment) => {
      classroomStudents.forEach((student) => {
        const key = `${student.id}::${assessment.id}`;
        const entry = (entriesByAssessment.get(assessment.id) || []).find((row) => row.student_id === student.id);
        next[key] = entry?.score === null || entry?.score === undefined ? '' : String(entry.score);
      });
    });
    setGridScores(next);
  }, [classroomStudents, contextAssessments, entriesByAssessment]);

  // Count unsaved changes in Excel Grid
  const unsavedGridCount = useMemo(() => {
    let count = 0;
    contextAssessments.forEach((assessment) => {
      classroomStudents.forEach((student) => {
        const key = `${student.id}::${assessment.id}`;
        const entry = (entriesByAssessment.get(assessment.id) || []).find((row) => row.student_id === student.id);
        const original = entry?.score === null || entry?.score === undefined ? '' : String(entry.score);
        const current = gridScores[key] ?? original;
        if (current !== original) {
          count += 1;
        }
      });
    });
    return count;
  }, [classroomStudents, contextAssessments, entriesByAssessment, gridScores]);

  // Save all changes in Excel Grid across all assessments
  async function handleSaveGridScores() {
    if (contextAssessments.length === 0 || classroomStudents.length === 0) return;
    setIsSubmitting(true);
    setNotice(null);

    const payload: {
      assessment_id: string;
      id?: string;
      note: string | null;
      score: number | null;
      student_id: string;
      workspace_id: string;
    }[] = [];

    for (const assessment of contextAssessments) {
      for (const student of classroomStudents) {
        const key = `${student.id}::${assessment.id}`;
        const rawScore = gridScores[key];
        const entry = (entriesByAssessment.get(assessment.id) || []).find((row) => row.student_id === student.id);
        const originalScore = entry?.score === null || entry?.score === undefined ? '' : String(entry.score);

        // Only process if changed or existing
        const score = rawScore === undefined || rawScore === '' ? null : Number(rawScore);
        if (score !== null && (!Number.isFinite(score) || score < 0 || score > assessment.max_score)) {
          setNotice(`คะแนนในชุด "${assessment.title}" ต้องอยู่ระหว่าง 0 ถึง ${assessment.max_score}`);
          setIsSubmitting(false);
          return;
        }

        if (rawScore !== originalScore) {
          payload.push({
            assessment_id: assessment.id,
            id: entry?.id,
            note: entry?.note || null,
            score,
            student_id: student.id,
            workspace_id: assessment.workspace_id,
          });
        }
      }
    }

    if (payload.length === 0) {
      setNotice('ไม่มีการเปลี่ยนแปลงคะแนนที่ต้องบันทึก');
      setIsSubmitting(false);
      return;
    }

    if (!supabase || isDemoSession(session)) {
      setEntries((current) => {
        const updatedMap = new Map(current.map((item) => [`${item.student_id}::${item.assessment_id}`, item]));
        payload.forEach((row) => {
          const key = `${row.student_id}::${row.assessment_id}`;
          const existing = updatedMap.get(key);
          updatedMap.set(key, {
            assessment_id: row.assessment_id,
            id: existing?.id || row.id || `demo-score-entry-${Date.now()}-${row.student_id}`,
            note: row.note,
            score: row.score,
            student_id: row.student_id,
          });
        });
        return Array.from(updatedMap.values());
      });
      setNotice(`บันทึกคะแนนในตารางรวมเรียบร้อย (${payload.length} ช่อง) [โหมดตัวอย่าง]`);
      setIsSubmitting(false);
      return;
    }

    const { data, error } = await supabase
      .from('score_entries')
      .upsert(
        payload.map((item) => ({
          assessment_id: item.assessment_id,
          note: item.note,
          score: item.score,
          student_id: item.student_id,
          workspace_id: item.workspace_id,
        })),
        { onConflict: 'assessment_id,student_id' },
      )
      .select('id,assessment_id,student_id,score,note');

    if (error) {
      setNotice(error.message);
      setIsSubmitting(false);
      return;
    }

    const savedEntries = (data || []) as ScoreEntryRow[];
    setEntries((current) => {
      const savedMap = new Map(savedEntries.map((entry) => [`${entry.student_id}::${entry.assessment_id}`, entry]));
      const next = current.filter((entry) => !savedMap.has(`${entry.student_id}::${entry.assessment_id}`));
      return [...next, ...savedEntries];
    });

    await writeAuditLog(session, {
      action: 'score_entries.grid_saved',
      entityId: activeClassroom?.id || '',
      entityTable: 'classrooms',
      metadata: {
        cells_updated: payload.length,
        classroom_id: classroomId,
        subject_name: subjectFilter,
      },
      riskLevel: 'low',
      source: 'score_center',
    });

    setNotice(`บันทึกคะแนนในตารางรวมเรียบร้อย (${payload.length} ช่อง)`);
    setIsSubmitting(false);
  }

  function handleResetGridScores() {
    const next: Record<string, string> = {};
    contextAssessments.forEach((assessment) => {
      classroomStudents.forEach((student) => {
        const key = `${student.id}::${assessment.id}`;
        const entry = (entriesByAssessment.get(assessment.id) || []).find((row) => row.student_id === student.id);
        next[key] = entry?.score === null || entry?.score === undefined ? '' : String(entry.score);
      });
    });
    setGridScores(next);
    setNotice('ยกเลิกการแก้ไขในตารางรวมแล้ว');
  }

  function exportGridCsv() {
    if (contextAssessments.length === 0 || classroomStudents.length === 0) return;

    const headers = [
      'รหัสประจำตัว',
      'ชื่อ',
      'นามสกุล',
      'ชื่อเล่น',
      ...contextAssessments.map((item) => `${item.title} (เต็ม ${item.max_score} | ${item.weight}%)`),
      'คะแนนรวมถ่วงน้ำหนัก',
      'ร้อยละ',
      'เกรดทางการ (0-4)',
    ];

    const rows = classroomStudents.map((student) => {
      let earnedTotal = 0;
      let plannedTotal = 0;

      const assessmentScores = contextAssessments.map((assessment) => {
        const key = `${student.id}::${assessment.id}`;
        const entry = (entriesByAssessment.get(assessment.id) || []).find((row) => row.student_id === student.id);
        const original = entry?.score === null || entry?.score === undefined ? '' : String(entry.score);
        const currentVal = gridScores[key] ?? original;
        const num = currentVal === '' ? null : Number(currentVal);

        plannedTotal += assessment.weight;
        if (num !== null && Number.isFinite(num)) {
          earnedTotal += (num / assessment.max_score) * assessment.weight;
        }

        return currentVal === '' ? '-' : currentVal;
      });

      const finalPercent = plannedTotal > 0 ? (earnedTotal / plannedTotal) * 100 : 0;
      const grade = getThaiGrade(finalPercent).grade;

      return [
        student.student_code || '',
        student.first_name,
        student.last_name,
        student.nickname || '',
        ...assessmentScores,
        formatScore(earnedTotal),
        `${finalPercent.toFixed(1)}%`,
        grade,
      ];
    });

    const csv = [headers, ...rows].map((row) => row.map((val) => escapeCsv(val)).join(',')).join('\n');
    downloadTextFile(`gradebook-grid-${activeClassroom?.name || 'classroom'}-${subjectFilter || 'subject'}.csv`, `\uFEFF${csv}`, 'text/csv;charset=utf-8');
  }

  return (
    <main className="app-page pb-24">
      {/* 1. Header & View Mode Switcher */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="nexus-kicker flex items-center gap-2 text-cyan-800">
            <Award size={16} aria-hidden="true" />
            ClassCare Score Center
          </div>
          <h1 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">
            ระบบบันทึกคะแนนและตัดเกรด
          </h1>
          <p className="mt-1 text-sm font-bold text-slate-500">
            กรอกคะแนนสะสม กลางภาค ปลายภาค พร้อมตัดเกรด 8 ระดับ (0 - 4) ตามเกณฑ์กระทรวงศึกษาธิการ
          </p>
        </div>

        {/* View Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
          {[
            { icon: Table, label: 'ตารางรวมแบบ Excel', value: 'excel' as ScoreView },
            { icon: ClipboardList, label: 'กรอกทีละชุด', value: 'entry' as ScoreView },
            { icon: FileSpreadsheet, label: 'สรุป & ตัดเกรด (0 - 4)', value: 'gradebook' as ScoreView },
            { icon: Layers, label: 'ภาพรวมทุกห้อง/วิชา', value: 'overview' as ScoreView },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = scoreView === item.value;
            return (
              <button
                className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-black transition ${
                  isActive
                    ? 'bg-slate-950 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
                key={item.value}
                onClick={() => handleScoreViewChange(item.value)}
                type="button"
              >
                <Icon size={15} aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 1.5 Dual-Perspective Switcher: Subject-Centric vs Classroom-Centric */}
      <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-2.5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-2xl">
            <button
              className={`flex-1 sm:flex-none inline-flex h-9 items-center justify-center gap-2 rounded-xl px-4 text-xs font-black transition ${
                perspective === 'subject'
                  ? 'bg-white text-indigo-900 shadow-xs ring-1 ring-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              onClick={() => handlePerspectiveChange('subject')}
              type="button"
            >
              <BookOpen size={15} className={perspective === 'subject' ? 'text-indigo-600' : 'text-slate-400'} aria-hidden="true" />
              มุมมองตามรายวิชา (วิชาที่สอนหลายห้อง)
            </button>
            <button
              className={`flex-1 sm:flex-none inline-flex h-9 items-center justify-center gap-2 rounded-xl px-4 text-xs font-black transition ${
                perspective === 'classroom'
                  ? 'bg-white text-slate-950 shadow-xs ring-1 ring-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              onClick={() => handlePerspectiveChange('classroom')}
              type="button"
            >
              <Users size={15} className={perspective === 'classroom' ? 'text-cyan-600' : 'text-slate-400'} aria-hidden="true" />
              มุมมองตามห้องเรียน (วิชาที่สอนห้องเดียว / ครูประจำชั้น)
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 px-2">
            {perspective === 'subject' ? (
              <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50/80 px-3 py-1 rounded-full border border-indigo-100 flex items-center gap-1.5">
                <Sparkles size={12} className="text-indigo-500" />
                เลือกวิชาเดียว จัดการได้ทุกห้องพร้อมกัน &amp; เปรียบเทียบผลคะแนน
              </span>
            ) : (
              <span className="text-[11px] font-bold text-slate-600 bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
                🏫 รวมทุกวิชาและสรุปเกรดของห้องเรียนที่เลือก
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. Unified Context Selector & Quick Action Bar */}
      <section className="mt-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="แถบควบคุมห้องและวิชา">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            {perspective === 'subject' ? (
              /* Subject-Centric Primary Selector */
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-indigo-900 shrink-0">รายวิชาที่สอน:</span>
                <select
                  className="h-10 rounded-2xl border border-indigo-200 bg-indigo-50/50 px-3 text-xs font-black text-indigo-950 outline-none transition focus:border-indigo-500 focus:bg-white"
                  onChange={(event) => {
                    const newSub = event.target.value;
                    setSubjectFilter(newSub);
                    const matchingClassrooms = classrooms.filter((c) =>
                      assessments.some(
                        (a) =>
                          a.classroom_id === c.id &&
                          a.status !== 'archived' &&
                          a.subject_name.trim().toLowerCase() === newSub.trim().toLowerCase(),
                      ),
                    );
                    if (matchingClassrooms.length > 0 && !matchingClassrooms.some((c) => c.id === classroomId)) {
                      setClassroomId(matchingClassrooms[0].id);
                    }
                  }}
                  value={subjectFilter}
                >
                  {subjectOptions.length === 0 ? <option value="">ยังไม่มีวิชา</option> : null}
                  {subjectOptions.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              /* Classroom-Centric Primary Selector */
              <>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-500 shrink-0">ห้องเรียน:</span>
                  <select
                    className="h-10 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-xs font-black text-slate-800 outline-none transition focus:border-cyan-400 focus:bg-white"
                    onChange={(event) => setClassroomId(event.target.value)}
                    value={classroomId}
                  >
                    {teacherScope.hasHomeroom ? (
                      <>
                        <optgroup label="⭐ ห้องที่ปรึกษาของฉัน">
                          {teacherScope.homeroomClassrooms.map((classroom) => (
                            <option key={classroom.id} value={classroom.id}>
                              {classroom.name} {classroom.academic_year ? `(${classroom.academic_year})` : ''}
                            </option>
                          ))}
                        </optgroup>
                        {teacherScope.otherClassrooms.length > 0 && (
                          <optgroup label="📚 ห้องที่สอนวิชา / ห้องอื่น">
                            {teacherScope.otherClassrooms.map((classroom) => (
                              <option key={classroom.id} value={classroom.id}>
                                {classroom.name} {classroom.academic_year ? `(${classroom.academic_year})` : ''}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </>
                    ) : (
                      classrooms.map((classroom) => (
                        <option key={classroom.id} value={classroom.id}>
                          {classroom.name} {classroom.academic_year ? `(${classroom.academic_year})` : ''}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-500 shrink-0">รายวิชา:</span>
                  <select
                    className="h-10 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-xs font-black text-slate-800 outline-none transition focus:border-cyan-400 focus:bg-white"
                    onChange={(event) => setSubjectFilter(event.target.value)}
                    value={subjectFilter}
                  >
                    {subjectOptions.length === 0 ? <option value="">ยังไม่มีวิชา</option> : null}
                    {subjectOptions.map((subject) => (
                      <option key={subject} value={subject}>
                        {subject}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* Assessment Select (Shown only when in single-entry view) */}
            {scoreView === 'entry' && contextAssessments.length > 0 && subjectSubView !== 'comparison' ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-500 shrink-0">ชุดคะแนน:</span>
                <select
                  className="h-10 max-w-[240px] truncate rounded-2xl border border-cyan-200 bg-cyan-50/60 px-3 text-xs font-black text-cyan-900 outline-none transition focus:border-cyan-400 focus:bg-white"
                  onChange={(event) => setSelectedAssessmentId(event.target.value)}
                  value={selectedAssessment?.id || ''}
                >
                  {contextAssessments.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title} (เต็ม {item.max_score} | {item.weight}%)
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {perspective === 'subject' ? (
              <button
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-2xl border border-indigo-200 bg-indigo-50/90 px-3.5 text-xs font-black text-indigo-900 shadow-2xs transition hover:bg-indigo-100 hover:border-indigo-300"
                onClick={() => {
                  setCloneSourceClassroomId(classroomsWithSubject[0]?.id || classroomId);
                  const otherClassrooms = classrooms.filter((c) => c.id !== (classroomsWithSubject[0]?.id || classroomId));
                  setCloneTargetClassroomIds(otherClassrooms.map((c) => c.id));
                  setIsCloneModalOpen(true);
                }}
                title="คัดลอกโครงสร้างคะแนนวิชานี้จากห้องหนึ่งไปยังห้องอื่น"
                type="button"
              >
                <Copy size={15} className="text-indigo-700" aria-hidden="true" />
                คัดลอกเกณฑ์ไปห้องอื่น
              </button>
            ) : null}

            <button
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-2xl border border-amber-200 bg-amber-50/90 px-3.5 text-xs font-black text-amber-900 shadow-2xs transition hover:bg-amber-100 hover:border-amber-300"
              onClick={() => setIsGuideOpen(true)}
              title="เปิดดูคู่มือการใช้งานระบบคะแนนและตาราง Excel"
              type="button"
            >
              <BookOpen size={15} className="text-amber-700" aria-hidden="true" />
              คู่มือการใช้งาน
            </button>

            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-4 text-xs font-black text-white shadow-2xs transition hover:bg-cyan-700"
              onClick={() => {
                setForm((current) => ({
                  ...current,
                  subjectName: subjectFilter || current.subjectName,
                  targetClassroomIds: perspective === 'subject' ? classroomsWithSubject.map((c) => c.id) : [classroomId],
                }));
                setIsCreateModalOpen(true);
              }}
              type="button"
            >
              <Plus size={15} aria-hidden="true" />
              สร้างชุดคะแนนใหม่
            </button>

            {scoreView === 'excel' && contextAssessments.length > 0 && subjectSubView !== 'comparison' ? (
              <button
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-xs font-black text-slate-700 transition hover:bg-slate-100"
                onClick={exportGridCsv}
                title="ส่งออกตารางรวมคะแนนเป็นไฟล์ Excel / CSV"
                type="button"
              >
                <Download size={14} aria-hidden="true" />
                Export ตาราง Excel
              </button>
            ) : null}

            {scoreView === 'entry' && selectedAssessment && subjectSubView !== 'comparison' ? (
              <button
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-xs font-black text-slate-700 transition hover:bg-slate-100"
                onClick={exportAssessmentCsv}
                title="ส่งออกเป็นไฟล์ Excel / CSV"
                type="button"
              >
                <Download size={14} aria-hidden="true" />
                CSV
              </button>
            ) : null}
          </div>
        </div>

        {/* Horizontal Classroom Tabs Bar (Visible in Subject-Centric Perspective) */}
        {perspective === 'subject' ? (
          <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-black text-slate-400 mr-1.5 flex items-center gap-1">
                <Users size={14} />
                ห้องที่สอน:
              </span>

              {classroomsWithSubject.map((c) => {
                const count = students.filter((s) => s.classroom_id === c.id).length;
                const isSelected = subjectSubView === 'grid' && classroomId === c.id;
                return (
                  <button
                    key={c.id}
                    className={`inline-flex items-center gap-2 rounded-2xl px-3.5 py-2 text-xs font-black transition ${
                      isSelected
                        ? 'bg-slate-950 text-white shadow-sm ring-1 ring-slate-900'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80 hover:text-slate-900'
                    }`}
                    onClick={() => {
                      setClassroomId(c.id);
                      setSubjectSubView('grid');
                    }}
                    type="button"
                  >
                    <span>ห้อง {c.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-white text-slate-600 border border-slate-200'
                      }`}
                    >
                      {count} คน
                    </span>
                  </button>
                );
              })}

              {/* Cross-Classroom Comparison Tab Button */}
              <button
                className={`inline-flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-black transition ${
                  subjectSubView === 'comparison'
                    ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-500'
                    : 'bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100'
                }`}
                onClick={() => setSubjectSubView('comparison')}
                type="button"
              >
                <BarChart3 size={14} />
                เปรียบเทียบผลสัมฤทธิ์ ({classroomsWithSubject.length} ห้อง)
              </button>
            </div>

            {/* Quick Link/Add another Classroom to this Subject */}
            {availableClassroomsToAdd.length > 0 ? (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400">สอนห้องอื่นด้วย:</span>
                <select
                  className="h-8 rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-[11px] font-black text-slate-700 outline-none hover:bg-white focus:border-indigo-400"
                  onChange={(e) => {
                    const cid = e.target.value;
                    if (!cid) return;
                    setClassroomId(cid);
                    setSubjectSubView('grid');
                    setForm((cur) => ({
                      ...cur,
                      subjectName: subjectFilter,
                      targetClassroomIds: [cid],
                    }));
                    setIsCreateModalOpen(true);
                  }}
                  value=""
                >
                  <option value="">+ เพิ่มห้องที่สอนวิชานี้...</option>
                  {availableClassroomsToAdd.map((c) => (
                    <option key={c.id} value={c.id}>
                      + ห้อง {c.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* Notice Banner */}
      {notice ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-xs font-black text-cyan-900 shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="shrink-0 text-cyan-700" size={16} aria-hidden="true" />
            <p>{notice}</p>
          </div>
          <button
            className="text-cyan-700 hover:text-cyan-950 text-xs underline"
            onClick={() => setNotice(null)}
            type="button"
          >
            ปิด
          </button>
        </div>
      ) : null}

      {/* 3. Main Views */}
      {perspective === 'subject' && subjectSubView === 'comparison' ? (
        <div className="mt-4 grid gap-4 animate-fade-in">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-indigo-700">
                <span className="text-xs font-black text-slate-500">ห้องเรียนที่สอน</span>
                <Users size={16} />
              </div>
              <p className="mt-2 text-2xl font-black text-slate-900">
                {overallSubjectStats.classroomCount} <span className="text-xs font-bold text-slate-500">ห้อง</span>
              </p>
              <p className="mt-1 text-[11px] font-bold text-slate-400">วิชา {subjectFilter}</p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-cyan-700">
                <span className="text-xs font-black text-slate-500">นักเรียนทั้งหมด</span>
                <GraduationCap size={16} />
              </div>
              <p className="mt-2 text-2xl font-black text-slate-900">
                {overallSubjectStats.totalStudents} <span className="text-xs font-bold text-slate-500">คน</span>
              </p>
              <p className="mt-1 text-[11px] font-bold text-slate-400">รวมทุกห้องที่สอนวิชานี้</p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-emerald-700">
                <span className="text-xs font-black text-slate-500">คะแนนเฉลี่ยรวม</span>
                <Award size={16} />
              </div>
              <p className="mt-2 text-2xl font-black text-emerald-600">{overallSubjectStats.avgPercent.toFixed(1)}%</p>
              <p className="mt-1 text-[11px] font-bold text-slate-400">
                เกรดเฉลี่ยกลุ่ม: {getThaiGrade(overallSubjectStats.avgPercent).grade}
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-blue-700">
                <span className="text-xs font-black text-slate-500">อัตราผ่านเกณฑ์</span>
                <CheckCircle2 size={16} />
              </div>
              <p className="mt-2 text-2xl font-black text-blue-600">{overallSubjectStats.overallPassingRate}%</p>
              <p className="mt-1 text-[11px] font-bold text-slate-400">ได้คะแนน &ge; 50%</p>
            </div>

            <div className="col-span-2 lg:col-span-1 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-amber-700">
                <span className="text-xs font-black text-slate-500">อัตราส่งงานครบ</span>
                <ClipboardList size={16} />
              </div>
              <p className="mt-2 text-2xl font-black text-amber-600">{overallSubjectStats.avgCompletion}%</p>
              <p className="mt-1 text-[11px] font-bold text-slate-400">{overallSubjectStats.totalAssessments} ชุดคะแนนรวม</p>
            </div>
          </div>

          {/* Comparative Table */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-0.5 text-xs font-black text-indigo-900">
                    <BarChart3 size={13} aria-hidden="true" />
                    แดชบอร์ดเปรียบเทียบผลสัมฤทธิ์รายห้อง
                  </span>
                  <span className="text-xs font-bold text-slate-500">วิชา {subjectFilter}</span>
                </div>
                <h2 className="mt-1 text-lg font-black text-slate-900 sm:text-xl">
                  สถิติผลสัมฤทธิ์ทางการเรียนและการส่งงาน ({crossClassroomStats.length} ห้องเรียน)
                </h2>
                <p className="text-xs font-bold text-slate-500">
                  เปรียบเทียบคะแนนเฉลี่ย อัตราผ่านเกณฑ์ และการกระจายของเกรดระหว่างห้องเรียนในวิชาเดียวกัน
                </p>
              </div>

              <button
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 text-xs font-black text-white hover:bg-indigo-700 transition self-start sm:self-auto shadow-sm"
                onClick={() => {
                  setCloneSourceClassroomId(classroomsWithSubject[0]?.id || '');
                  const otherIds = classrooms.filter((c) => c.id !== classroomsWithSubject[0]?.id).map((c) => c.id);
                  setCloneTargetClassroomIds(otherIds);
                  setIsCloneModalOpen(true);
                }}
                type="button"
              >
                <Copy size={14} aria-hidden="true" />
                คัดลอกเกณฑ์ไปห้องอื่น
              </button>
            </div>

            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-black">
                    <th className="px-4 py-3 border-b border-slate-200">ห้องเรียน</th>
                    <th className="px-3 py-3 border-b border-slate-200 text-center">นักเรียน</th>
                    <th className="px-3 py-3 border-b border-slate-200 text-center">ชุดคะแนน</th>
                    <th className="px-3 py-3 border-b border-slate-200 text-center">ส่งงานครบ (%)</th>
                    <th className="px-3 py-3 border-b border-slate-200 text-center">คะแนนเฉลี่ย (%)</th>
                    <th className="px-3 py-3 border-b border-slate-200 text-center">ผ่านเกณฑ์</th>
                    <th className="px-4 py-3 border-b border-slate-200 min-w-[180px]">การกระจายเกรด (4 / 3 / 2 / 1 / 0)</th>
                    <th className="px-4 py-3 border-b border-slate-200 text-right">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {crossClassroomStats.map((row) => (
                    <tr key={row.classroom.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3.5 font-black text-slate-900">
                        <div className="flex items-center gap-2">
                          <span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-100 text-slate-700 text-xs font-black">
                            {row.classroom.name.slice(0, 4)}
                          </span>
                          <div>
                            <p className="font-black text-slate-900">{row.classroom.name}</p>
                            <p className="text-[10px] text-slate-400 font-normal">ปี {row.classroom.academic_year || '2569'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-center font-bold text-slate-700">{row.studentCount} คน</td>
                      <td className="px-3 py-3.5 text-center font-bold text-slate-700">{row.assessmentCount} ชุด</td>
                      <td className="px-3 py-3.5 text-center">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-black ${
                            row.completionPercent >= 80 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {row.completionPercent}%
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        <div className="flex flex-col items-center">
                          <span className="font-black text-slate-900 text-sm">{row.averagePercent.toFixed(1)}%</span>
                          <span className="text-[10px] font-bold text-slate-400">
                            เกรด {getThaiGrade(row.averagePercent).grade}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        <span className="font-black text-slate-800">{row.passingRate}%</span>
                        <span className="text-[10px] text-slate-400 block">
                          ({row.passingCount}/{row.studentCount})
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1 text-[10px] font-mono">
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800 font-bold" title="เกรด 4">
                            4: {row.gradeCounts.g4}
                          </span>
                          <span className="rounded bg-teal-100 px-1.5 py-0.5 text-teal-800 font-bold" title="เกรด 3 หรือ 3.5">
                            3: {row.gradeCounts.g3}
                          </span>
                          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-800 font-bold" title="เกรด 2 หรือ 2.5">
                            2: {row.gradeCounts.g2}
                          </span>
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800 font-bold" title="เกรด 1 หรือ 1.5">
                            1: {row.gradeCounts.g1}
                          </span>
                          <span className="rounded bg-rose-100 px-1.5 py-0.5 text-rose-800 font-bold" title="เกรด 0">
                            0: {row.gradeCounts.g0}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl bg-cyan-50 px-3 text-xs font-black text-cyan-800 hover:bg-cyan-100 transition border border-cyan-200"
                          onClick={() => {
                            setClassroomId(row.classroom.id);
                            setSubjectSubView('grid');
                          }}
                          type="button"
                        >
                          📝 เข้ากรอกคะแนน
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* 3A: EXCEL GRID VIEW (All assessments in one spreadsheet) */}
          {scoreView === 'excel' ? (
            <div className="mt-4 grid gap-4">
              <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-black text-emerald-800">
                    <Table size={13} aria-hidden="true" />
                    โหมดตารางรวมสเปรดชีต (Excel Grid)
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    {contextAssessments.length} ช่องคะแนน | {classroomStudents.length} นักเรียน
                  </span>
                </div>
                <h2 className="mt-2 text-xl font-black text-slate-950 sm:text-2xl">
                  ตารางบันทึกคะแนนรวมรายวิชา {subjectFilter}
                </h2>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  ห้อง {activeClassroom?.name} | เลื่อนช่องได้ด้วยปุ่มลูกศร (← ↑ → ↓) หรือ Tab | วางจาก Excel ได้โดยตรง | ตัดเกรดคำนวณสดทันที
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-black text-slate-700 hover:bg-slate-100 transition"
                  onClick={exportGridCsv}
                  type="button"
                >
                  <Download size={14} aria-hidden="true" />
                  ส่งออก Excel / CSV
                </button>
                <button
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-cyan-600 px-4 text-xs font-black text-white hover:bg-cyan-700 shadow-sm transition"
                  onClick={() => setIsCreateModalOpen(true)}
                  type="button"
                >
                  <Plus size={14} aria-hidden="true" />
                  เพิ่มช่องคะแนนใหม่
                </button>
              </div>
            </div>

            {/* Excel Grid Helper Banner */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-50 p-3 border border-slate-200/80 text-xs font-bold text-slate-600">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-white px-2 py-0.5 font-mono text-[11px] font-black text-slate-800 shadow-2xs border border-slate-200">Tab</span>
                <span>เลื่อนไปช่องถัดไป</span>
                <span className="text-slate-300">|</span>
                <span className="rounded-md bg-white px-2 py-0.5 font-mono text-[11px] font-black text-slate-800 shadow-2xs border border-slate-200">Enter / ↓</span>
                <span>เลื่อนลงคนถัดไป</span>
                <span className="text-slate-300">|</span>
                <span className="rounded-md bg-white px-2 py-0.5 font-mono text-[11px] font-black text-slate-800 shadow-2xs border border-slate-200">Ctrl + V</span>
                <span>วางคะแนนจาก Excel ได้ทั้งแถบ</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">น้ำหนักแผนรวม:</span>
                <span className={`font-black ${plannedTotalWeight === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {plannedTotalWeight} / 100 คะแนน
                </span>
              </div>
            </div>

            {/* Full Spreadsheet Grid Table */}
            {contextAssessments.length > 0 ? (
              <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full min-w-[900px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-black">
                      {/* Fixed Left Columns: Roster */}
                      <th className="sticky left-0 z-20 bg-slate-100 px-3 py-3 w-16 border-b border-r border-slate-200">
                        เลขที่
                      </th>
                      <th className="sticky left-16 z-20 bg-slate-100 px-3 py-3 w-48 border-b border-r border-slate-200">
                        ชื่อ - นามสกุล
                      </th>

                      {/* Dynamic Assessment Columns */}
                      {contextAssessments.map((assessment, aIdx) => (
                        <th
                          className="px-3 py-3 text-center border-b border-r border-slate-200 min-w-[130px] max-w-[170px]"
                          key={assessment.id}
                        >
                          <div className="flex flex-col items-center">
                            <span className="truncate w-full font-black text-slate-900" title={assessment.title}>
                              {aIdx + 1}. {assessment.title}
                            </span>
                            <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-slate-500">
                              <span className="rounded bg-white px-1.5 py-0.2 border border-slate-200 text-cyan-800">
                                เต็ม {assessment.max_score}
                              </span>
                              <span>({assessment.weight}%)</span>
                            </div>
                            <button
                              className="mt-1 text-[9px] font-bold text-cyan-700 hover:underline"
                              onClick={() => {
                                setSelectedAssessmentId(assessment.id);
                                handleScoreViewChange('entry');
                              }}
                              title="ดูรายละเอียดหรือจัดการเฉพาะชุดนี้"
                              type="button"
                            >
                              ตรวจแยกชุด →
                            </button>
                          </div>
                        </th>
                      ))}

                      {/* Fixed Right Columns: Calculated Total & Grade */}
                      <th className="px-3 py-3 text-center border-b border-r border-slate-200 min-w-[110px] bg-slate-100 font-black text-slate-900">
                        รวมถ่วงน้ำหนัก
                      </th>
                      <th className="px-3 py-3 text-center border-b border-r border-slate-200 min-w-[90px] bg-slate-100 font-black text-slate-900">
                        ร้อยละ
                      </th>
                      <th className="px-3 py-3 text-center border-b border-slate-200 min-w-[110px] bg-cyan-50 font-black text-cyan-900">
                        เกรด 0-4
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.map((student, sIdx) => {
                      let earnedTotal = 0;
                      let plannedTotal = 0;

                      // Pre-calculate live totals for this student row
                      contextAssessments.forEach((assessment) => {
                        const cellKey = `${student.id}::${assessment.id}`;
                        const entry = (entriesByAssessment.get(assessment.id) || []).find((row) => row.student_id === student.id);
                        const rawScore = gridScores[cellKey] ?? (entry?.score === null || entry?.score === undefined ? '' : String(entry.score));
                        const num = rawScore === '' ? null : Number(rawScore);

                        plannedTotal += assessment.weight;
                        if (num !== null && Number.isFinite(num)) {
                          earnedTotal += (num / assessment.max_score) * assessment.weight;
                        }
                      });

                      const finalPercent = plannedTotal > 0 ? (earnedTotal / plannedTotal) * 100 : 0;
                      const gradeInfo = getThaiGrade(finalPercent);

                      return (
                        <tr className="hover:bg-slate-50 transition group" key={student.id}>
                          {/* Sticky Roster Cells */}
                          <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 px-3 py-2 text-slate-500 font-mono text-center border-r border-slate-200">
                            {student.student_code || sIdx + 1}
                          </td>
                          <td className="sticky left-16 z-10 bg-white group-hover:bg-slate-50 px-3 py-2 border-r border-slate-200 font-bold">
                            <p className="truncate font-black text-slate-900">
                              {student.first_name} {student.last_name}
                            </p>
                            {student.nickname ? (
                              <p className="text-[10px] text-slate-400 font-normal">({student.nickname})</p>
                            ) : null}
                          </td>

                          {/* Editable Cells for Each Assessment */}
                          {contextAssessments.map((assessment, aIdx) => {
                            const cellKey = `${student.id}::${assessment.id}`;
                            const entry = (entriesByAssessment.get(assessment.id) || []).find((row) => row.student_id === student.id);
                            const origScore = entry?.score === null || entry?.score === undefined ? '' : String(entry.score);
                            const currentVal = gridScores[cellKey] ?? origScore;
                            const isModified = currentVal !== origScore;
                            const numVal = currentVal === '' ? null : Number(currentVal);
                            const isInvalid = numVal !== null && (!Number.isFinite(numVal) || numVal < 0 || numVal > assessment.max_score);

                            return (
                              <td
                                className={`px-2 py-1.5 text-center border-r border-slate-200 ${
                                  isModified ? 'bg-amber-50/70' : ''
                                }`}
                                key={assessment.id}
                              >
                                <input
                                  className={`h-9 w-20 rounded-lg border text-center font-mono text-xs font-black outline-none transition ${
                                    isInvalid
                                      ? 'border-rose-400 bg-rose-50 text-rose-700'
                                      : isModified
                                        ? 'border-amber-400 bg-white text-slate-900 shadow-2xs focus:ring-2 focus:ring-amber-200'
                                        : 'border-slate-200 bg-white text-slate-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100'
                                  }`}
                                  data-grid-row={sIdx}
                                  data-grid-col={aIdx}
                                  max={assessment.max_score}
                                  min="0"
                                  onChange={(event) => {
                                    const val = event.target.value;
                                    setGridScores((current) => ({ ...current, [cellKey]: val }));
                                  }}
                                  onKeyDown={(event) => {
                                    // Excel arrow key navigation
                                    if (event.key === 'ArrowDown' || event.key === 'Enter') {
                                      event.preventDefault();
                                      document.querySelector<HTMLInputElement>(`[data-grid-row="${sIdx + 1}"][data-grid-col="${aIdx}"]`)?.focus();
                                    } else if (event.key === 'ArrowUp') {
                                      event.preventDefault();
                                      document.querySelector<HTMLInputElement>(`[data-grid-row="${sIdx - 1}"][data-grid-col="${aIdx}"]`)?.focus();
                                    } else if (event.key === 'ArrowRight' && (event.target as HTMLInputElement).selectionStart === (event.target as HTMLInputElement).value.length) {
                                      document.querySelector<HTMLInputElement>(`[data-grid-row="${sIdx}"][data-grid-col="${aIdx + 1}"]`)?.focus();
                                    } else if (event.key === 'ArrowLeft' && (event.target as HTMLInputElement).selectionStart === 0) {
                                      document.querySelector<HTMLInputElement>(`[data-grid-row="${sIdx}"][data-grid-col="${aIdx - 1}"]`)?.focus();
                                    }
                                  }}
                                  onPaste={(event) => {
                                    // 2D Matrix paste from Excel
                                    const clipText = event.clipboardData.getData('text');
                                    const rows = clipText.split(/\r?\n/).filter((r) => r.length > 0);
                                    if (rows.length === 1 && !rows[0].includes('\t')) return; // Single cell paste normal behavior

                                    event.preventDefault();
                                    const nextUpdates: Record<string, string> = {};
                                    let pasteCount = 0;

                                    rows.forEach((rowStr, rOffset) => {
                                      const targetStudent = filteredStudents[sIdx + rOffset];
                                      if (!targetStudent) return;
                                      const cols = rowStr.split('\t');
                                      cols.forEach((colVal, cOffset) => {
                                        const targetAssessment = contextAssessments[aIdx + cOffset];
                                        if (!targetAssessment) return;
                                        const trimmed = colVal.trim();
                                        const nVal = Number(trimmed);
                                        if (trimmed === '' || (Number.isFinite(nVal) && nVal >= 0 && nVal <= targetAssessment.max_score)) {
                                          nextUpdates[`${targetStudent.id}::${targetAssessment.id}`] = trimmed;
                                          pasteCount += 1;
                                        }
                                      });
                                    });

                                    setGridScores((current) => ({ ...current, ...nextUpdates }));
                                    setNotice(`วางข้อมูลจาก Excel ลงตารางสำเร็จ (${pasteCount} เซลล์) อย่าลืมกดบันทึก`);
                                  }}
                                  placeholder="-"
                                  step="any"
                                  type="number"
                                  value={currentVal}
                                />
                              </td>
                            );
                          })}

                          {/* Calculated Columns */}
                          <td className="px-3 py-2 text-center font-mono font-black text-slate-800 border-r border-slate-200 bg-slate-50/50">
                            {formatScore(earnedTotal)} <span className="text-slate-400 font-normal">/ {formatScore(plannedTotal)}</span>
                          </td>
                          <td className="px-3 py-2 text-center border-r border-slate-200">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-black ring-1 ${
                                finalPercent < 50
                                  ? 'bg-rose-50 text-rose-700 ring-rose-200'
                                  : finalPercent < 70
                                    ? 'bg-amber-50 text-amber-700 ring-amber-200'
                                    : 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                              }`}
                            >
                              {finalPercent.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center bg-cyan-50/40">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-black ring-1 ${gradeInfo.badgeClass}`}
                            >
                              เกรด {gradeInfo.grade}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center border border-dashed border-slate-200 rounded-2xl mt-4">
                <Table className="mx-auto text-slate-300" size={36} aria-hidden="true" />
                <h3 className="mt-2 text-sm font-black text-slate-800">ยังไม่มีช่องคะแนนในวิชานี้</h3>
                <p className="mt-1 text-xs text-slate-500">สร้างช่องคะแนนแรกเพื่อเริ่มกรอกในตารางรวม</p>
                <button
                  className="mt-3 inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-cyan-600 px-4 text-xs font-black text-white hover:bg-cyan-700 transition"
                  onClick={() => setIsCreateModalOpen(true)}
                  type="button"
                >
                  <Plus size={14} aria-hidden="true" />
                  เพิ่มช่องคะแนน
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* 3B: SINGLE ENTRY VIEW */}
      {scoreView === 'entry' ? (
        <div className="mt-4 grid gap-4">
          {selectedAssessment ? (
            <>
              {/* Active Assessment Banner */}
              <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-cyan-100 px-3 py-0.5 text-xs font-black text-cyan-800">
                        {categoryLabels[selectedAssessment.category]}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-black ring-1 ${
                          selectedAssessment.status === 'published'
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                            : 'bg-amber-50 text-amber-700 ring-amber-200'
                        }`}
                      >
                        {selectedAssessment.status === 'published' ? 'เผยแพร่แล้ว' : 'ฉบับร่าง (Draft)'}
                      </span>
                      <span className="text-xs font-bold text-slate-400">
                        วันที่: {selectedAssessment.assessment_date}
                      </span>
                    </div>
                    <h2 className="mt-2 text-xl font-black text-slate-950 sm:text-2xl">
                      {selectedAssessment.title}
                    </h2>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      คะแนนเต็ม: <span className="font-black text-slate-800">{selectedAssessment.max_score}</span> คะแนน 
                      | น้ำหนักเกรด: <span className="font-black text-slate-800">{selectedAssessment.weight}%</span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-black transition ring-1 ${
                        selectedAssessment.status === 'published'
                          ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 ring-amber-200'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 ring-emerald-200'
                      }`}
                      disabled={isSubmitting}
                      onClick={() => void handlePublishAssessment()}
                      type="button"
                    >
                      <CheckCircle2 size={14} aria-hidden="true" />
                      {selectedAssessment.status === 'published' ? 'กลับเป็นฉบับร่าง' : 'เผยแพร่คะแนน'}
                    </button>
                    <button
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-black text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                      disabled={isSubmitting}
                      onClick={() => void handleDeleteAssessment(selectedAssessment)}
                      type="button"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                      ลบชุดนี้
                    </button>
                  </div>
                </div>

                {/* KPI Metrics */}
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 pt-4 border-t border-slate-100">
                  <div className="rounded-2xl bg-slate-50 p-3 text-center">
                    <p className="text-xl font-black text-slate-900">{scoreStats.complete} / {classroomStudents.length}</p>
                    <p className="mt-0.5 text-[11px] font-bold text-slate-500">กรอกครบแล้ว ({scoreStats.percentComplete}%)</p>
                  </div>
                  <div className="rounded-2xl bg-cyan-50/50 p-3 text-center">
                    <p className="text-xl font-black text-cyan-900">{scoreStats.average.toFixed(1)} / {selectedAssessment.max_score}</p>
                    <p className="mt-0.5 text-[11px] font-bold text-cyan-700">คะแนนเฉลี่ย</p>
                  </div>
                  <div className="rounded-2xl bg-emerald-50/50 p-3 text-center">
                    <p className="text-xl font-black text-emerald-900">{scoreStats.highest} / {selectedAssessment.max_score}</p>
                    <p className="mt-0.5 text-[11px] font-bold text-emerald-700">คะแนนสูงสุด</p>
                  </div>
                  <div className="rounded-2xl bg-rose-50/50 p-3 text-center">
                    <p className="text-xl font-black text-rose-900">{scoreStats.belowHalf} คน</p>
                    <p className="mt-0.5 text-[11px] font-bold text-rose-700">ต่ำกว่าเกณฑ์ 50%</p>
                  </div>
                </div>
              </div>

              {/* Student Score Table Section */}
              <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
                {/* Search and Helper Toolbar */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex h-10 w-full sm:max-w-xs items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 focus-within:border-cyan-400 focus-within:bg-white">
                    <Search className="shrink-0 text-slate-400" size={15} aria-hidden="true" />
                    <input
                      className="w-full bg-transparent outline-none placeholder:text-slate-400"
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="ค้นหาชื่อ เลขที่ หรือรหัส..."
                      value={searchTerm}
                    />
                  </label>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-2xl border border-cyan-200 bg-cyan-50 px-3 text-xs font-black text-cyan-800 transition hover:bg-cyan-100"
                      onClick={handleFillAllMaxScore}
                      title="ใส่คะแนนเต็มให้นักเรียนทุกคนทันที"
                      type="button"
                    >
                      <Sparkles size={14} aria-hidden="true" />
                      ให้คะแนนเต็มทุกคน ({selectedAssessment.max_score})
                    </button>
                    <span className="hidden text-xs font-bold text-slate-400 xl:inline">
                      💡 เคล็ดลับ: กด Enter หรือ ลูกศรลง เพื่อเลื่อนไปคนถัดไป | วางจาก Excel ได้โดยตรง
                    </span>
                  </div>
                </div>

                {/* Score Table */}
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[760px] divide-y divide-slate-100 text-left">
                    <thead>
                      <tr className="bg-slate-50/80 text-[11px] font-black uppercase text-slate-500">
                        <th className="px-3 py-2.5">รหัส</th>
                        <th className="px-3 py-2.5">ชื่อ-นามสกุล</th>
                        <th className="px-3 py-2.5 w-44">
                          คะแนน (เต็ม {selectedAssessment.max_score})
                        </th>
                        <th className="px-3 py-2.5">ร้อยละ</th>
                        <th className="px-3 py-2.5">เกรดประเมิน</th>
                        <th className="px-3 py-2.5">หมายเหตุ</th>
                        <th className="px-3 py-2.5 text-right">ล้าง</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                      {filteredStudents.map((student) => {
                        const entry = selectedEntryByStudent.get(student.id);
                        const scoreValue = scores[student.id] ?? (entry?.score === null || entry?.score === undefined ? '' : String(entry.score));
                        const scoreNumber = scoreValue === '' ? null : Number(scoreValue);
                        const percent =
                          scoreNumber !== null && Number.isFinite(scoreNumber)
                            ? Math.round((scoreNumber / selectedAssessment.max_score) * 10000) / 100
                            : null;
                        const gradeInfo = getThaiGrade(percent);

                        return (
                          <tr className="hover:bg-slate-50/80 transition" key={student.id}>
                            <td className="whitespace-nowrap px-3 py-3 text-slate-500 font-mono">
                              {student.student_code || '-'}
                            </td>
                            <td className="px-3 py-3">
                              <p className="font-black text-slate-900">
                                {student.first_name} {student.last_name}
                              </p>
                              {student.nickname ? (
                                <p className="text-[11px] font-bold text-slate-400">({student.nickname})</p>
                              ) : null}
                            </td>
                            <td className="whitespace-nowrap px-3 py-3">
                              <div className="flex items-center gap-1.5">
                                <input
                                  className="h-10 w-20 rounded-xl border border-slate-200 bg-white px-2.5 text-center text-sm font-black text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                                  data-score-student={student.id}
                                  max={selectedAssessment.max_score}
                                  min="0"
                                  onChange={(event) =>
                                    setScores((current) => ({ ...current, [student.id]: event.target.value }))
                                  }
                                  onKeyDown={(event) => {
                                    if (event.key !== 'Enter' && event.key !== 'ArrowDown') return;
                                    event.preventDefault();
                                    const index = filteredStudents.findIndex((item) => item.id === student.id);
                                    const nextId = filteredStudents[index + 1]?.id;
                                    if (nextId) document.querySelector<HTMLInputElement>(`[data-score-student="${nextId}"]`)?.focus();
                                  }}
                                  onPaste={(event) => {
                                    const values = event.clipboardData.getData('text')
                                      .split(/\r?\n|\t/)
                                      .map((value) => value.trim())
                                      .filter(Boolean);
                                    if (values.length < 2) return;
                                    event.preventDefault();
                                    const startIndex = filteredStudents.findIndex((item) => item.id === student.id);
                                    const maximum = selectedAssessment.max_score;
                                    setScores((current) => {
                                      const next = { ...current };
                                      values.forEach((value, offset) => {
                                        const target = filteredStudents[startIndex + offset];
                                        const numericValue = Number(value);
                                        if (target && Number.isFinite(numericValue) && numericValue >= 0 && numericValue <= maximum) {
                                          next[target.id] = String(numericValue);
                                        }
                                      });
                                      return next;
                                    });
                                    setNotice(`วางคะแนนจาก Excel ${Math.min(values.length, filteredStudents.length - startIndex)} คนแล้ว ตรวจสอบก่อนกดบันทึก`);
                                  }}
                                  placeholder="-"
                                  step="any"
                                  type="number"
                                  value={scoreValue}
                                />
                                <button
                                  className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10px] font-black text-slate-600 hover:bg-cyan-50 hover:text-cyan-700 hover:border-cyan-200 transition"
                                  onClick={() =>
                                    setScores((current) => ({ ...current, [student.id]: String(selectedAssessment.max_score) }))
                                  }
                                  title="ให้คะแนนเต็มสำหรับคนนี้"
                                  type="button"
                                >
                                  เต็ม
                                </button>
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3">
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-black ring-1 ${
                                  percent === null
                                    ? 'bg-slate-50 text-slate-400 ring-slate-200'
                                    : percent < 50
                                      ? 'bg-rose-50 text-rose-700 ring-rose-200'
                                      : percent < 70
                                        ? 'bg-amber-50 text-amber-700 ring-amber-200'
                                        : 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                                }`}
                              >
                                {percent === null ? '-' : `${percent}%`}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black ring-1 ${gradeInfo.badgeClass}`}
                                title={gradeInfo.label}
                              >
                                เกรด {gradeInfo.grade}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <input
                                className="h-9 w-full min-w-[150px] rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 outline-none transition focus:border-cyan-400"
                                onChange={(event) =>
                                  setNotes((current) => ({ ...current, [student.id]: event.target.value }))
                                }
                                placeholder="บันทึกเพิ่มเติม..."
                                value={notes[student.id] ?? entry?.note ?? ''}
                              />
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-right">
                              <button
                                className="rounded-xl p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                                onClick={() => void handleClearStudentScore(student)}
                                title="ล้างคะแนนคนนี้"
                                type="button"
                              >
                                <Trash2 size={14} aria-hidden="true" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {filteredStudents.length === 0 ? (
                  <div className="py-8 text-center text-sm font-bold text-slate-400">
                    {classroomStudents.length === 0
                      ? 'ห้องเรียนนี้ยังไม่มีรายชื่อนักเรียน กรุณาเพิ่มรายชื่อนักเรียนก่อน'
                      : 'ไม่พบนักเรียนตามคำค้นหา'}
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
              <ClipboardList className="mx-auto text-slate-300" size={40} aria-hidden="true" />
              <h3 className="mt-3 text-lg font-black text-slate-800">ยังไม่มีชุดคะแนนในวิชานี้</h3>
              <p className="mt-1 text-xs font-bold text-slate-500">
                เริ่มสร้างชุดคะแนนแรก เช่น คะแนนระหว่างเรียน หรือ สอบกลางภาค เพื่อเริ่มบันทึกคะแนน
              </p>
              <button
                className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-5 text-xs font-black text-white shadow-sm hover:bg-cyan-700 transition"
                onClick={() => setIsCreateModalOpen(true)}
                type="button"
              >
                <Plus size={16} aria-hidden="true" />
                สร้างชุดคะแนนแรก
              </button>
            </div>
          )}
        </div>
      ) : null}

      {/* 3B: MASTER GRADEBOOK (0 - 4 SCALE) */}
      {scoreView === 'gradebook' ? (
        <div className="mt-4 grid gap-4">
          {/* Gradebook Header & Weight Meter */}
          <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black text-cyan-700">Master Gradebook</p>
                <h2 className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">
                  สมุดรวมคะแนนและตัดเกรด 8 ระดับ (0 - 4)
                </h2>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  วิชา {subjectFilter || 'ทั้งหมด'} | ห้อง {activeClassroom?.name} | ตัดเกรดอิงเกณฑ์กระทรวงศึกษาธิการ
                </p>
              </div>

              {/* Planned Weight Progress Meter */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 min-w-[240px]">
                <div className="flex items-center justify-between text-xs font-black">
                  <span className="text-slate-600">น้ำหนักคะแนนที่วางไว้:</span>
                  <span className={plannedTotalWeight === 100 ? 'text-emerald-700 font-black' : 'text-amber-700 font-black'}>
                    {plannedTotalWeight} / 100 คะแนน
                  </span>
                </div>
                <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full transition-all duration-300 ${
                      plannedTotalWeight === 100
                        ? 'bg-emerald-500'
                        : plannedTotalWeight > 100
                          ? 'bg-rose-500'
                          : 'bg-amber-500'
                    }`}
                    style={{ width: `${Math.min(plannedTotalWeight, 100)}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[10px] font-bold text-slate-400 text-right">
                  {plannedTotalWeight === 100
                    ? '✓ โครงสร้างคะแนนครบ 100 พอดี'
                    : plannedTotalWeight < 100
                      ? `ขาดอีก ${100 - plannedTotalWeight} คะแนนให้ครบ 100`
                      : `เกินไป ${plannedTotalWeight - 100} คะแนน`}
                </p>
              </div>
            </div>

            {/* 3 Bands Breakdown */}
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3 pt-4 border-t border-slate-100">
              {scoreBandSummaries.map((band) => (
                <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3" key={band.key}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black text-slate-800">{band.label}</p>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-cyan-800 shadow-2xs">
                      {band.plannedWeight} / {band.recommendedWeight} คะแนน
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] font-bold text-slate-500">{band.description}</p>
                  <div className="mt-3 flex items-center justify-between text-[11px] font-bold text-slate-600">
                    <span>{band.assessmentCount} ชุดคะแนน</span>
                    <span>กรอกครบ {band.completePercent}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Master Table */}
          <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] divide-y divide-slate-100 text-left">
                <thead>
                  <tr className="bg-slate-50/80 text-[11px] font-black uppercase text-slate-500">
                    <th className="px-3 py-2.5">รหัส</th>
                    <th className="px-3 py-2.5">นักเรียน</th>
                    <th className="px-3 py-2.5">ระหว่างเรียน</th>
                    <th className="px-3 py-2.5">กลางภาค</th>
                    <th className="px-3 py-2.5">ปลายภาค</th>
                    <th className="px-3 py-2.5">รวมถ่วงน้ำหนัก</th>
                    <th className="px-3 py-2.5">ร้อยละสะสม</th>
                    <th className="px-3 py-2.5 text-center">เกรดทางการ (0 - 4)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                  {studentGradebookRows.map((row) => {
                    const gradeInfo = getThaiGrade(row.finalPercent);

                    return (
                      <tr className="hover:bg-slate-50/80 transition" key={row.student.id}>
                        <td className="whitespace-nowrap px-3 py-3 text-slate-500 font-mono">
                          {row.student.student_code || '-'}
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-black text-slate-900">
                            {row.student.first_name} {row.student.last_name}
                          </p>
                          {row.student.nickname ? (
                            <p className="text-[11px] font-bold text-slate-400">({row.student.nickname})</p>
                          ) : null}
                        </td>
                        {scoreBandConfigs.map((band) => {
                          const score = row.bandScores[band.key];
                          return (
                            <td className="whitespace-nowrap px-3 py-3 font-mono text-slate-800" key={band.key}>
                              {formatScore(score.earnedWeight)} <span className="text-slate-400 font-normal">/ {formatScore(score.plannedWeight)}</span>
                            </td>
                          );
                        })}
                        <td className="whitespace-nowrap px-3 py-3 font-mono font-black text-slate-900">
                          {formatScore(row.earnedTotal)} <span className="text-slate-400 font-normal">/ {formatScore(row.plannedWeight)}</span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-black ring-1 ${
                              row.completionPercent < 100
                                ? 'bg-amber-50 text-amber-700 ring-amber-200'
                                : row.finalPercent < 50
                                  ? 'bg-rose-50 text-rose-700 ring-rose-200'
                                  : 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                            }`}
                          >
                            {row.finalPercent.toFixed(1)}%
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ring-1 ${gradeInfo.badgeClass}`}
                          >
                            เกรด {gradeInfo.grade} ({gradeInfo.label})
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {studentGradebookRows.length === 0 ? (
              <div className="py-8 text-center text-sm font-bold text-slate-400">
                ยังไม่มีข้อมูลนักเรียนในห้องนี้
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* 3C: TEACHING MATRIX / OVERVIEW */}
      {scoreView === 'overview' ? (
        <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black text-cyan-700">Teaching Matrix</p>
              <h2 className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">
                ภาพรวมทุกห้องเรียนและรายวิชา
              </h2>
              <p className="mt-1 text-xs font-bold text-slate-500">
                คลิกที่การ์ดเพื่อสลับไปยังห้องเรียนและวิชานั้นทันที
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
              {scoreContexts.length} บริบทการสอน
            </span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {scoreContexts.map((context) => (
              <button
                className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-left shadow-xs transition hover:border-cyan-300 hover:bg-white hover:shadow-md"
                key={`${context.classroomId}-${context.subjectName}-overview`}
                onClick={() => {
                  setClassroomId(context.classroomId);
                  setSubjectFilter(context.subjectName);
                  handleScoreViewChange('entry');
                  setSelectedAssessmentId(
                    assessments.find(
                      (assessment) =>
                        assessment.classroom_id === context.classroomId &&
                        assessment.subject_name === context.subjectName &&
                        assessment.status !== 'archived',
                    )?.id || '',
                  );
                }}
                type="button"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-base font-black text-slate-900">{context.subjectName}</p>
                    <p className="mt-0.5 text-xs font-bold text-slate-500">{context.classroomName}</p>
                  </div>
                  <span className="rounded-full bg-cyan-100 px-2.5 py-0.5 text-[11px] font-black text-cyan-800">
                    {context.completePercent}% ครบ
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-white p-2 border border-slate-100">
                    <p className="text-base font-black text-slate-900">{context.assessmentCount}</p>
                    <p className="text-[10px] font-bold text-slate-400">ชุดคะแนน</p>
                  </div>
                  <div className="rounded-xl bg-white p-2 border border-slate-100">
                    <p className="text-base font-black text-slate-900">{context.studentCount}</p>
                    <p className="text-[10px] font-bold text-slate-400">นักเรียน</p>
                  </div>
                  <div className="rounded-xl bg-white p-2 border border-slate-100">
                    <p className="text-base font-black text-slate-900">{context.averagePercent.toFixed(0)}%</p>
                    <p className="text-[10px] font-bold text-slate-400">คะแนนเฉลี่ย</p>
                  </div>
                </div>
              </button>
            ))}

            {scoreContexts.length === 0 ? (
              <div className="py-8 text-center text-sm font-bold text-slate-400 col-span-full">
                ยังไม่มีบริบทคะแนน ให้สร้างชุดคะแนนแรกก่อน
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
        </>
      )}

      {/* 4. Sticky Floating Save Bar (Triggered when there are unsaved edits in Entry or Excel Grid) */}
      {scoreView === 'excel' && unsavedGridCount > 0 ? (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl bg-slate-950 px-5 py-3 text-white shadow-2xl animate-fade-in ring-1 ring-white/15">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-500 text-xs font-black text-white">
              {unsavedGridCount}
            </span>
            <span className="text-xs font-bold text-slate-200">
              มีคะแนนในตาราง Excel ที่แก้ไขและยังไม่ได้บันทึก
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="inline-flex h-9 items-center justify-center gap-1 rounded-xl bg-slate-800 px-3 text-xs font-bold text-slate-300 hover:bg-slate-700 transition"
              disabled={isSubmitting}
              onClick={handleResetGridScores}
              type="button"
            >
              <RotateCcw size={13} aria-hidden="true" />
              ยกเลิก
            </button>
            <button
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-4 text-xs font-black text-white shadow-md hover:bg-emerald-400 transition disabled:opacity-50"
              disabled={isSubmitting}
              onClick={() => void handleSaveGridScores()}
              type="button"
            >
              <Save size={14} aria-hidden="true" />
              {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกตารางคะแนนทั้งหมด'}
            </button>
            {nextClassroom ? (
              <button
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 text-xs font-black text-white shadow-md hover:bg-indigo-500 transition disabled:opacity-50"
                disabled={isSubmitting}
                onClick={async () => {
                  await handleSaveGridScores();
                  setClassroomId(nextClassroom.id);
                }}
                title={`บันทึกคะแนนห้องนี้แล้วสลับไปกรอกคะแนนห้อง ${nextClassroom.name} ทันที`}
                type="button"
              >
                บันทึกแล้วไป {nextClassroom.name}
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {scoreView === 'entry' && unsavedCount > 0 && selectedAssessment ? (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl bg-slate-950 px-5 py-3 text-white shadow-2xl animate-fade-in ring-1 ring-white/15">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-cyan-500 text-xs font-black text-white">
              {unsavedCount}
            </span>
            <span className="text-xs font-bold text-slate-200">
              มีการแก้ไขคะแนน/หมายเหตุที่ยังไม่ได้บันทึก
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="inline-flex h-9 items-center justify-center gap-1 rounded-xl bg-slate-800 px-3 text-xs font-bold text-slate-300 hover:bg-slate-700 transition"
              disabled={isSubmitting}
              onClick={handleResetUnsaved}
              type="button"
            >
              <RotateCcw size={13} aria-hidden="true" />
              ยกเลิก
            </button>
            <button
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-cyan-500 px-4 text-xs font-black text-white shadow-md hover:bg-cyan-400 transition disabled:opacity-50"
              disabled={isSubmitting}
              onClick={() => void handleSaveScores()}
              type="button"
            >
              <Save size={14} aria-hidden="true" />
              {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกคะแนนทั้งหมด'}
            </button>
            {nextClassroom ? (
              <button
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 text-xs font-black text-white shadow-md hover:bg-indigo-500 transition disabled:opacity-50"
                disabled={isSubmitting}
                onClick={async () => {
                  await handleSaveScores();
                  setClassroomId(nextClassroom.id);
                }}
                title={`บันทึกคะแนนห้องนี้แล้วสลับไปกรอกคะแนนห้อง ${nextClassroom.name} ทันที`}
                type="button"
              >
                บันทึกแล้วไป {nextClassroom.name}
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* 5. Create Assessment Modal Dialog */}
      {isCreateModalOpen ? (
        <div
          aria-labelledby="modal-create-assessment-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          role="dialog"
        >
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-50 text-cyan-700">
                  <Plus size={18} aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900" id="modal-create-assessment-title">
                    สร้างชุดคะแนนใหม่
                  </h3>
                  <p className="text-xs font-bold text-slate-500">
                    ห้อง {activeClassroom?.name} | {subjectFilter || form.subjectName}
                  </p>
                </div>
              </div>
              <button
                className="grid h-8 w-8 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                onClick={() => setIsCreateModalOpen(false)}
                type="button"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            {/* Quick Presets */}
            <div className="mt-4 rounded-2xl bg-slate-50 p-3 border border-slate-100">
              <span className="text-[11px] font-black uppercase text-slate-500">เลือกโครงสร้างคะแนนด่วน:</span>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {[
                  { category: 'assignment' as AssessmentCategory, maxScore: '10', title: 'คะแนนระหว่างเรียน', weight: '10' },
                  { category: 'midterm' as AssessmentCategory, maxScore: '20', title: 'สอบกลางภาค', weight: '20' },
                  { category: 'final' as AssessmentCategory, maxScore: '30', title: 'สอบปลายภาค', weight: '30' },
                ].map((preset) => (
                  <button
                    className="rounded-xl border border-slate-200 bg-white p-2 text-center text-xs font-black text-slate-800 transition hover:border-cyan-400 hover:bg-cyan-50"
                    key={preset.category}
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        category: preset.category,
                        maxScore: preset.maxScore,
                        title: preset.title,
                        weight: preset.weight,
                      }))
                    }
                    type="button"
                  >
                    <p className="truncate text-slate-900">{preset.title}</p>
                    <p className="mt-0.5 text-[10px] font-bold text-cyan-700">{preset.maxScore} คะแนน ({preset.weight}%)</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Form */}
            <form className="mt-4 grid gap-3" onSubmit={(event) => void handleCreateAssessment(event)}>
              {/* Target Classrooms Selection */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                    <Users size={14} className="text-indigo-600" />
                    ใช้กับห้องเรียนใดบ้าง:
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      className="text-[11px] font-bold text-indigo-700 hover:underline"
                      onClick={() => setForm((c) => ({ ...c, targetClassroomIds: classrooms.map((cl) => cl.id) }))}
                    >
                      เลือกทุกห้อง
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      className="text-[11px] font-bold text-slate-500 hover:underline"
                      onClick={() => setForm((c) => ({ ...c, targetClassroomIds: [classroomId] }))}
                    >
                      เฉพาะห้องปัจจุบัน
                    </button>
                  </div>
                </div>

                <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {classrooms.map((c) => {
                    const isChecked =
                      form.targetClassroomIds.length === 0
                        ? c.id === classroomId
                        : form.targetClassroomIds.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        className={`flex items-center gap-2 rounded-xl p-2 text-xs font-bold border transition cursor-pointer ${
                          isChecked
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-950 font-black ring-1 ring-indigo-200'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                          checked={isChecked}
                          onChange={(e) => {
                            const currentList =
                              form.targetClassroomIds.length === 0 ? [classroomId] : form.targetClassroomIds;
                            if (e.target.checked) {
                              setForm((cur) => ({ ...cur, targetClassroomIds: [...currentList, c.id] }));
                            } else {
                              setForm((cur) => ({
                                ...cur,
                                targetClassroomIds: currentList.filter((id) => id !== c.id),
                              }));
                            }
                          }}
                        />
                        <span className="truncate">{c.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block">
                  <span className="text-xs font-black text-slate-600">รายวิชา</span>
                  <input
                    className="nexus-field mt-1.5 h-10 px-3 text-xs font-bold w-full"
                    list="score-subject-options-modal"
                    onChange={(event) => {
                      setForm((current) => ({ ...current, subjectName: event.target.value }));
                      setSubjectFilter(event.target.value);
                    }}
                    value={form.subjectName}
                  />
                  <datalist id="score-subject-options-modal">
                    {subjectOptions.map((subject) => (
                      <option key={subject} value={subject} />
                    ))}
                  </datalist>
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-black text-slate-600">ชื่อชุดคะแนน</span>
                <input
                  className="nexus-field mt-1.5 h-10 px-3 text-xs font-bold"
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="เช่น แบบฝึกหัดบทที่ 2 / สอบกลางภาค"
                  required
                  value={form.title}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-black text-slate-600">ประเภท</span>
                  <select
                    className="nexus-field mt-1.5 h-10 px-3 text-xs font-bold"
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

                <label className="block">
                  <span className="text-xs font-black text-slate-600">วันที่ประเมิน</span>
                  <ThaiDatePicker
                    className="mt-1.5 h-10 px-3 text-xs font-bold"
                    onValueChange={(value) => setForm((current) => ({ ...current, assessmentDate: value }))}
                    value={form.assessmentDate}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-black text-slate-600">คะแนนเต็ม</span>
                  <input
                    className="nexus-field mt-1.5 h-10 px-3 text-xs font-bold"
                    min="1"
                    onChange={(event) => setForm((current) => ({ ...current, maxScore: event.target.value }))}
                    type="number"
                    value={form.maxScore}
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-black text-slate-600">น้ำหนักคะแนน (%)</span>
                  <input
                    className="nexus-field mt-1.5 h-10 px-3 text-xs font-bold"
                    min="1"
                    onChange={(event) => setForm((current) => ({ ...current, weight: event.target.value }))}
                    type="number"
                    value={form.weight}
                  />
                </label>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  className="h-10 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 hover:bg-slate-50 transition"
                  onClick={() => setIsCreateModalOpen(false)}
                  type="button"
                >
                  ยกเลิก
                </button>
                <button
                  className="h-10 rounded-2xl bg-cyan-600 px-5 text-xs font-black text-white shadow-sm hover:bg-cyan-700 transition disabled:opacity-50"
                  disabled={isSubmitting || isLoading}
                  type="submit"
                >
                  {isSubmitting ? 'กำลังสร้าง...' : 'สร้างและเริ่มกรอกคะแนน'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* 5.5 Clone Score Structure Modal Dialog */}
      {isCloneModalOpen ? (
        <div
          aria-labelledby="modal-clone-score-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          role="dialog"
        >
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-50 text-cyan-600">
                  <Copy size={20} aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900" id="modal-clone-score-title">
                    คัดลอกโครงสร้างคะแนนไปห้องอื่น
                  </h3>
                  <p className="text-xs text-slate-500">
                    วิชา: <span className="font-bold text-cyan-700">{subjectFilter || 'ไม่ระบุ'}</span>
                  </p>
                </div>
              </div>
              <button
                aria-label="ปิดหน้าต่างคัดลอกเกณฑ์คะแนน"
                className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                onClick={() => setIsCloneModalOpen(false)}
                type="button"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="clone-source-select">
                  1. เลือกห้องต้นแบบ (คัดลอกรายการคะแนนจากห้องนี้)
                </label>
                <select
                  id="clone-source-select"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:border-cyan-500 focus:outline-hidden"
                  value={cloneSourceClassroomId}
                  onChange={(e) => setCloneSourceClassroomId(e.target.value)}
                >
                  <option value="">-- กรุณาเลือกห้องต้นแบบ --</option>
                  {classrooms.map((c) => {
                    const count = assessments.filter(
                      (a) =>
                        a.classroom_id === c.id &&
                        a.status !== 'archived' &&
                        a.subject_name.trim().toLowerCase() === (subjectFilter || '').trim().toLowerCase(),
                    ).length;
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name} ({count} ชุดคะแนน)
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    2. เลือกห้องปลายทาง (ที่จะรับชุดคะแนนนี้)
                  </label>
                  <div className="flex gap-2 text-[11px]">
                    <button
                      type="button"
                      className="text-cyan-700 font-bold hover:underline"
                      onClick={() =>
                        setCloneTargetClassroomIds(
                          classrooms.filter((c) => c.id !== cloneSourceClassroomId).map((c) => c.id),
                        )
                      }
                    >
                      เลือกทั้งหมด
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      className="text-slate-500 hover:underline"
                      onClick={() => setCloneTargetClassroomIds([])}
                    >
                      ล้างการเลือก
                    </button>
                  </div>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-2xl border border-slate-200 p-2.5 bg-white">
                  {classrooms
                    .filter((c) => c.id !== cloneSourceClassroomId)
                    .map((c) => {
                      const isSelected = cloneTargetClassroomIds.includes(c.id);
                      const existingCount = assessments.filter(
                        (a) =>
                          a.classroom_id === c.id &&
                          a.status !== 'archived' &&
                          a.subject_name.trim().toLowerCase() === (subjectFilter || '').trim().toLowerCase(),
                      ).length;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setCloneTargetClassroomIds((prev) =>
                              prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id],
                            );
                          }}
                          className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs transition text-left ${
                            isSelected
                              ? 'bg-cyan-50/80 text-cyan-900 border border-cyan-200'
                              : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {isSelected ? (
                              <CheckSquare size={16} className="text-cyan-600" />
                            ) : (
                              <Square size={16} className="text-slate-400" />
                            )}
                            <span className="font-bold">{c.name}</span>
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {existingCount > 0 ? `มีอยู่แล้ว ${existingCount} รายการ` : 'ยังไม่มีชุดคะแนน'}
                          </span>
                        </button>
                      );
                    })}
                  {classrooms.filter((c) => c.id !== cloneSourceClassroomId).length === 0 ? (
                    <p className="text-xs text-center text-slate-400 py-3">ไม่มีห้องปลายทางอื่น</p>
                  ) : null}
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-amber-800 text-[11px] border border-amber-200">
                <Info size={16} className="shrink-0 mt-0.5 text-amber-600" />
                <p>
                  ระบบจะคัดลอกเฉพาะชุดคะแนนที่ยังไม่มีอยู่ในห้องปลายทาง โดยอิงตามชื่อชุดคะแนน (ป้องกันการเกิดชุดคะแนนซ้ำซ้อน)
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                className="rounded-2xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                onClick={() => setIsCloneModalOpen(false)}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={!cloneSourceClassroomId || cloneTargetClassroomIds.length === 0 || isSubmitting}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-cyan-600 px-5 py-2.5 text-xs font-black text-white shadow-sm hover:bg-cyan-700 transition disabled:opacity-50"
                onClick={() => void handleCloneStructure()}
              >
                <Copy size={14} aria-hidden="true" />
                {isSubmitting ? 'กำลังคัดลอก...' : `คัดลอกไปยัง ${cloneTargetClassroomIds.length} ห้อง`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 6. User Guide Modal Dialog (เด้งขึ้นอัตโนมัติเมื่อเข้าหน้า พร้อมเปิดดูได้ตลอดเวลา) */}
      {isGuideOpen ? (
        <div
          aria-labelledby="modal-score-guide-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-xs"
          role="dialog"
        >
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl animate-scale-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-950 via-cyan-950 to-slate-900 px-6 py-5 text-white">
              <div className="flex items-center gap-3.5">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400/30 backdrop-blur-sm">
                  <BookOpen size={24} aria-hidden="true" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-cyan-400/20 px-2.5 py-0.5 text-[11px] font-black text-cyan-200 ring-1 ring-cyan-400/30">
                      <Sparkles size={11} aria-hidden="true" />
                      ClassCare 360 • Score Manual
                    </span>
                  </div>
                  <h2 className="mt-1 text-lg font-black text-white sm:text-xl" id="modal-score-guide-title">
                    คู่มือการใช้งานระบบบันทึกคะแนน (ตารางรวมแบบ Excel)
                  </h2>
                  <p className="text-xs font-bold text-slate-300">
                    แนวทางใช้งานตารางกรอกคะแนน, แป้นพิมพ์ลัด, วางข้อมูลจาก Excel และการตัดเกรด 0 - 4
                  </p>
                </div>
              </div>
              <button
                className="grid h-9 w-9 place-items-center rounded-2xl bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white"
                onClick={() => setIsGuideOpen(false)}
                type="button"
                aria-label="ปิดหน้าต่างคู่มือ"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-slate-700">
              {/* 1. Quick Start 3 Steps */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                  <span className="grid h-6 w-6 place-items-center rounded-lg bg-cyan-100 text-cyan-800 text-xs">1</span>
                  <h3>เริ่มต้นใช้งานด่วนใน 3 ขั้นตอน</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition hover:bg-slate-50">
                    <div className="flex items-center gap-2 text-cyan-700">
                      <Table size={16} />
                      <h4 className="text-xs font-black text-slate-900">1. เลือกห้องและวิชา</h4>
                    </div>
                    <p className="mt-1.5 text-xs font-medium leading-5 text-slate-600">
                      เลือกห้องเรียน เช่น <strong>ป.5, ป.6</strong> และเลือกรายวิชาจากแถบด้านบน หากยังไม่มีชิ้นงานให้กดปุ่ม <strong>&ldquo;สร้างชุดคะแนนใหม่&rdquo;</strong>
                    </p>
                  </div>

                  <div className="rounded-2xl border border-cyan-200 bg-cyan-50/50 p-4 transition hover:bg-cyan-50/80">
                    <div className="flex items-center gap-2 text-cyan-800">
                      <Copy size={16} />
                      <h4 className="text-xs font-black text-slate-900">2. กรอกหรือวางคะแนน</h4>
                    </div>
                    <p className="mt-1.5 text-xs font-medium leading-5 text-slate-600">
                      คลิกช่องเพื่อพิมพ์คะแนนโดยตรง หรือ <strong>Copy จากไฟล์ Excel</strong> มากด <strong>Ctrl + V</strong> วางลงทั้งคอลัมน์ได้ทันที
                    </p>
                  </div>

                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 transition hover:bg-emerald-50/80">
                    <div className="flex items-center gap-2 text-emerald-800">
                      <CheckCircle2 size={16} />
                      <h4 className="text-xs font-black text-slate-900">3. ตรวจเกรด &amp; บันทึก</h4>
                    </div>
                    <p className="mt-1.5 text-xs font-medium leading-5 text-slate-600">
                      ระบบคำนวณคะแนนรวมและเกรด 0-4 สดทันที เมื่อกรอกครบแล้วกดปุ่ม <strong>&ldquo;บันทึกคะแนน&rdquo;</strong> ด้านล่าง
                    </p>
                  </div>
                </div>
              </section>

              {/* 2. Keyboard Navigation Guide */}
              <section className="rounded-2xl border border-slate-200 bg-white p-4.5 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                  <Keyboard size={18} className="text-cyan-700" />
                  <h3>คีย์บอร์ดนำทางในตาราง (เหมือน Microsoft Excel)</h3>
                </div>
                <p className="text-xs font-medium text-slate-500">
                  ช่วยให้คุณครูกรอกคะแนนได้รวดเร็วโดยไม่ต้องเอื้อมมือไปจับเมาส์:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                    <span className="font-bold text-slate-700">เลื่อนช่องคะแนนอิสระ</span>
                    <span className="flex items-center gap-1 font-mono text-[11px] font-black text-slate-800">
                      <kbd className="rounded-md border border-slate-300 bg-white px-1.5 py-0.5 shadow-xs">↑</kbd>
                      <kbd className="rounded-md border border-slate-300 bg-white px-1.5 py-0.5 shadow-xs">↓</kbd>
                      <kbd className="rounded-md border border-slate-300 bg-white px-1.5 py-0.5 shadow-xs">←</kbd>
                      <kbd className="rounded-md border border-slate-300 bg-white px-1.5 py-0.5 shadow-xs">→</kbd>
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                    <span className="font-bold text-slate-700">ลงไปนักเรียนคนถัดไปทันที</span>
                    <kbd className="rounded-md border border-slate-300 bg-white px-2 py-0.5 font-mono text-[11px] font-black text-slate-800 shadow-xs">
                      Enter
                    </kbd>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                    <span className="font-bold text-slate-700">เลื่อนไปคอลัมน์ถัดไป / ย้อนหลัง</span>
                    <span className="flex items-center gap-1 font-mono text-[11px] font-black text-slate-800">
                      <kbd className="rounded-md border border-slate-300 bg-white px-1.5 py-0.5 shadow-xs">Tab</kbd>
                      <span className="text-slate-400">/</span>
                      <kbd className="rounded-md border border-slate-300 bg-white px-1.5 py-0.5 shadow-xs">Shift+Tab</kbd>
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                    <span className="font-bold text-slate-700">ลบคะแนนในช่องที่เลือก</span>
                    <span className="flex items-center gap-1 font-mono text-[11px] font-black text-slate-800">
                      <kbd className="rounded-md border border-slate-300 bg-white px-1.5 py-0.5 shadow-xs">Backspace</kbd>
                      <span className="text-slate-400">/</span>
                      <kbd className="rounded-md border border-slate-300 bg-white px-1.5 py-0.5 shadow-xs">Del</kbd>
                    </span>
                  </div>
                </div>
              </section>

              {/* 3. Batch Paste from Excel */}
              <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4.5 space-y-2.5">
                <div className="flex items-center gap-2 text-sm font-black text-amber-950">
                  <Lightbulb size={18} className="text-amber-600" />
                  <h3>เคล็ดลับเด็ด! คัดลอกและวางจากไฟล์ Excel (Batch Paste)</h3>
                </div>
                <p className="text-xs font-medium leading-5 text-amber-900">
                  หากมีไฟล์คะแนนใน Microsoft Excel หรือ Google Sheets อยู่แล้ว คุณครูไม่ต้องเสียเวลาพิมพ์ทีละคน:
                </p>
                <ol className="list-decimal pl-5 text-xs font-medium leading-6 text-amber-950 space-y-1">
                  <li>ในโปรแกรม <strong>Excel / Sheets</strong>: คลุมแถบคะแนนทั้งคอลัมน์ของนักเรียน แล้วกด <kbd className="rounded border border-amber-300 bg-white px-1.5 py-0.5 font-mono text-[11px] font-bold">Ctrl + C</kbd></li>
                  <li>ใน <strong>ClassCare 360</strong>: คลิกที่ช่องคะแนนของ <strong>นักเรียนคนแรก</strong> ในชิ้นงานนั้น</li>
                  <li>กด <kbd className="rounded border border-amber-300 bg-white px-1.5 py-0.5 font-mono text-[11px] font-bold">Ctrl + V</kbd> : ระบบจะนำคะแนนทั้งหมดมาเรียงต่อกันให้อัตโนมัติตามลำดับนักเรียนทันที!</li>
                </ol>
              </section>

              {/* 4. Thai Grade Scale 0-4 */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                    <Award size={18} className="text-cyan-700" />
                    <h3>เกณฑ์การตัดเกรด 8 ระดับ (มาตรฐาน สพฐ. / กระทรวงศึกษาธิการ)</h3>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500">คำนวณถ่วงน้ำหนัก % อัตโนมัติ</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {[
                    { badge: 'bg-emerald-100 text-emerald-800 ring-emerald-300', grade: '4', label: 'ดีเยี่ยม', range: '80 - 100%' },
                    { badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200', grade: '3.5', label: 'ดีมาก', range: '75 - 79%' },
                    { badge: 'bg-teal-50 text-teal-800 ring-teal-200', grade: '3', label: 'ดี', range: '70 - 74%' },
                    { badge: 'bg-cyan-50 text-cyan-800 ring-cyan-200', grade: '2.5', label: 'ค่อนข้างดี', range: '65 - 69%' },
                    { badge: 'bg-blue-50 text-blue-800 ring-blue-200', grade: '2', label: 'ปานกลาง', range: '60 - 64%' },
                    { badge: 'bg-amber-50 text-amber-800 ring-amber-200', grade: '1.5', label: 'พอใช้', range: '55 - 59%' },
                    { badge: 'bg-orange-50 text-orange-800 ring-orange-200', grade: '1', label: 'ผ่านเกณฑ์', range: '50 - 54%' },
                    { badge: 'bg-rose-50 text-rose-800 ring-rose-200', grade: '0', label: 'ต่ำกว่าเกณฑ์', range: '0 - 49%' },
                  ].map((item) => (
                    <div key={item.grade} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs">
                      <div>
                        <div className="font-bold text-slate-800">{item.range}</div>
                        <div className="text-[10px] font-medium text-slate-500">{item.label}</div>
                      </div>
                      <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black ring-1 ${item.badge}`}>
                        {item.grade}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              {/* 5. Export & Reports */}
              <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                  <Download size={16} className="text-cyan-700" />
                  <h3>การส่งออกไฟล์ Excel และเอกสาร ปพ.5</h3>
                </div>
                <p className="text-xs font-medium leading-5 text-slate-600">
                  • <strong>Export ตาราง Excel (.CSV):</strong> กดปุ่ม &ldquo;Export ตาราง Excel&rdquo; ด้านบนเพื่อดาวน์โหลดคะแนนทุกชิ้นงาน คะแนนรวม ร้อยละ และเกรด ไปเปิดในโปรแกรม Excel ได้ทันที<br />
                  • <strong>พิมพ์รายงาน ปพ.5 ทางการ:</strong> สามารถไปที่เมนู <strong>&ldquo;รายงาน (Reports)&rdquo;</strong> ทางแถบเมนูด้านซ้าย เพื่อพิมพ์แบบบันทึกผลการเรียนรายวิชาหรือดาวน์โหลดเป็น PDF ทางการ
                </p>
              </section>
            </div>

            {/* Modal Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <p className="flex items-center gap-1.5 text-xs font-bold text-slate-500 text-center sm:text-left">
                <Info size={14} className="text-cyan-700 shrink-0" />
                คุณครูสามารถกดเปิดคู่มือนี้ซ้ำได้ตลอดเวลา โดยคลิกปุ่ม &ldquo;คู่มือการใช้งาน&rdquo; ที่แถบด้านบน
              </p>
              <button
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-6 py-2.5 text-xs font-black text-white shadow-md shadow-cyan-600/20 transition hover:bg-cyan-700"
                onClick={() => setIsGuideOpen(false)}
                type="button"
              >
                <CheckCircle2 size={16} />
                เข้าใจแล้ว เริ่มกรอกคะแนน
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <footer className="mt-8 text-center text-xs font-bold text-slate-400">
        Created by MIKPURINUT • ClassCare 360
      </footer>
    </main>
  );
}
