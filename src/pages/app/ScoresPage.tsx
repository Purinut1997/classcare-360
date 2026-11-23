import { type FormEvent, Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  Camera,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Copy,
  Download,
  Edit3,
  FileSpreadsheet,
  Gauge,
  GraduationCap,
  HelpCircle,
  Info,
  Keyboard,
  Lightbulb,
  Lock,
  Plus,
  RotateCcw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Square,
  Table,
  Target,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ContextLink as Link } from '../../components/navigation/ContextLink';
import { ThaiDatePicker } from '../../components/shared/ThaiDatePicker';
import { ModernGradebookSheet } from '../../components/scores/ModernGradebookSheet';
import { SubjectCardsHub, type SubjectCardItem } from '../../components/scores/SubjectCardsHub';
const ScoreOcrModal = lazy(() =>
  import('../../components/scores/ScoreOcrModal').then((m) => ({ default: m.ScoreOcrModal })),
);
const RubricAndQuizModal = lazy(() =>
  import('../../components/scores/RubricAndQuizModal').then((m) => ({ default: m.RubricAndQuizModal })),
);
const AcademicSubjectsModal = lazy(() =>
  import('../../components/academic/AcademicSubjectsModal').then((m) => ({ default: m.AcademicSubjectsModal })),
);
const OfficialAcademicDocumentsModal = lazy(() =>
  import('../../components/academic/OfficialAcademicDocumentsModal').then((m) => ({
    default: m.OfficialAcademicDocumentsModal,
  })),
);
const TermClosingWizardModal = lazy(() =>
  import('../../components/academic/TermClosingWizardModal').then((m) => ({ default: m.TermClosingWizardModal })),
);

import { getBangkokDate } from '../../lib/date';
import { isDemoSession, withDemoContext } from '../../lib/auth';
import { enqueueOfflineMutation, isLikelyNetworkError } from '../../lib/offlineSyncQueue';
import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import { writeAuditLog } from '../../lib/auditLog';
import {
  getHiddenClassroomIds,
  getTeacherClassroomScope,
  isObsoleteGhostClassroom,
} from '../../lib/teacherClassrooms';
import {
  getLocalScoreRatio,
  hydrateHiddenClassroomsFromCloud,
  loadCloudScoreRatio,
  saveCloudScoreRatio,
} from '../../lib/workspaceCloudPrefs';
import { DEFAULT_PRIMARY_SUBJECTS_TEMPLATE, type SchoolSubject } from '../../types/academic';
import type { AppSessionContext } from '../../types/core';
import { DEMO_PRIMARY_CLASSROOMS, DEMO_PRIMARY_STUDENTS, getPrimaryMasterData, autoRealignAllStudentsToCorrectRooms } from '../../data/p5MasterTemplate';

interface ScoresPageProps {
  session: AppSessionContext;
}

type AssessmentCategory = 'quiz' | 'assignment' | 'midterm' | 'final' | 'exam' | 'project' | 'reading' | 'other';
type AssessmentStatus = 'draft' | 'published' | 'archived';
type ScoreBand = 'coursework' | 'midterm' | 'final';
type ScoreView = 'subjects' | 'overview' | 'entry' | 'excel' | 'gradebook';
export type ScorePerspective = 'subject' | 'classroom';

const scoreViewValues = ['subjects', 'overview', 'entry', 'excel', 'gradebook'] as const;

function isScoreView(value: string | null): value is ScoreView {
  return Boolean(value && scoreViewValues.includes(value as ScoreView));
}

function parseActiveAcademicTerm(termName?: string | null): '1' | '2' | 'yearly' {
  if (!termName) return '1';
  if (/ตลอดปี|yearly/i.test(termName)) return 'yearly';
  const primarySegment = termName.split('/')[0] || termName;
  return primarySegment.includes('2') ? '2' : '1';
}

function adaptObecSubjectCode(baseCode: string, gradeLevel: string): string {
  const cleanGrade = gradeLevel.replace(/\s+/g, '');
  const pMatch = cleanGrade.match(/^(?:ป\.|ประถมศึกษาปีที่)?([1-6])$/);
  const mMatch = cleanGrade.match(/^(?:ม\.|มัธยมศึกษาปีที่)([1-6])$/);
  const codeMatch = baseCode.match(/^([^\d]+)\d{2}(\d{3})$/);
  if (!codeMatch) return baseCode;
  if (pMatch) return `${codeMatch[1]}1${pMatch[1]}${codeMatch[2]}`;
  if (mMatch) return `${codeMatch[1]}2${mMatch[1]}${codeMatch[2]}`;
  return baseCode;
}

function buildDemoSchoolSubjects(workspaceId: string, gradeLevel: string): SchoolSubject[] {
  const nowIso = new Date().toISOString();
  return DEFAULT_PRIMARY_SUBJECTS_TEMPLATE.map((tpl, index) => ({
    id: `demo-sub-${index + 1}`,
    workspace_id: workspaceId,
    subject_code: adaptObecSubjectCode(tpl.code, gradeLevel),
    subject_name: tpl.name,
    learning_area: tpl.area,
    subject_type: 'basic',
    grade_level: gradeLevel,
    hours_per_year: tpl.hours,
    hours_per_week: Number((tpl.hours / 40).toFixed(1)),
    credit: tpl.credit,
    teacher_profile_id: 'demo-teacher',
    is_active: true,
    created_at: nowIso,
    updated_at: nowIso,
  }));
}

function readCachedSchoolSubjects(workspaceId: string, gradeHint?: string): SchoolSubject[] {
  if (typeof window === 'undefined' || !workspaceId) return [];
  const candidateGrades = [
    ...(gradeHint ? [gradeHint] : []),
    'ป.1',
    'ป.2',
    'ป.3',
    'ป.4',
    'ป.5',
    'ป.6',
    'ม.1',
    'ม.2',
    'ม.3',
  ];
  const merged = new Map<string, SchoolSubject>();
  for (const grade of candidateGrades) {
    try {
      const raw = window.localStorage.getItem(`classcare_academic_subjects_${workspaceId}_${grade}`);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) continue;
      parsed.forEach((item: SchoolSubject) => {
        if (item?.subject_code && item?.subject_name) {
          merged.set(`${item.subject_code}::${item.grade_level}`, item);
        }
      });
    } catch {
      // Ignore localStorage read/parse failure.
    }
  }
  return Array.from(merged.values());
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
  status?: string | null;
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
  metadata?: Record<string, unknown> | null;
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

const demoClassrooms: ClassroomRow[] = DEMO_PRIMARY_CLASSROOMS;

const demoStudents: StudentRow[] = DEMO_PRIMARY_STUDENTS;

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

function getScoreBand(
  item: AssessmentCategory | { category: AssessmentCategory; metadata?: Record<string, unknown> | null; title?: string },
): ScoreBand {
  const category = typeof item === 'string' ? item : item.category;
  const metadata = typeof item === 'string' ? null : (item.metadata as Record<string, unknown> | null | undefined);
  const title = typeof item === 'string' ? '' : item.title || '';

  if (category === 'midterm' || metadata?.exam_type === 'midterm') return 'midterm';
  if (category === 'final' || metadata?.exam_type === 'final') return 'final';

  const t = title.toLowerCase();
  if (t.includes('กลางภาค') || t.includes('midterm')) return 'midterm';
  if (t.includes('ปลายภาค') || t.includes('final')) return 'final';
  return 'coursework';
}

function getAssessmentCategoryLabel(assessment: {
  category: AssessmentCategory;
  metadata?: Record<string, unknown> | null;
  title?: string;
}): string {
  const band = getScoreBand(assessment);
  if (band === 'midterm') return 'กลางภาค';
  if (band === 'final') return 'ปลายภาค';
  return categoryLabels[assessment.category] || assessment.category;
}

function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function buildQuickScorePresets(maxScore: number): number[] {
  if (!Number.isFinite(maxScore) || maxScore <= 0) return [];
  const candidates = [maxScore, Math.round(maxScore * 0.8), Math.round(maxScore * 0.5)];
  return Array.from(new Set(candidates.filter((value) => value > 0 && value <= maxScore)));
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

const SCORES_PERSPECTIVE_STORAGE_KEY = 'classcare_scores_perspective';

const getDefaultEntryScoreView = (): 'entry' | 'excel' =>
  typeof window !== 'undefined' && window.innerWidth < 768 ? 'entry' : 'excel';

export function ScoresPage({ session }: ScoresPageProps) {
  const demoMode = isDemoSession(session);
  const location = useLocation();
  const navigate = useNavigate();
  const requestedScoreView = new URLSearchParams(location.search).get('scoreView');
  const initialScoreView: ScoreView = isScoreView(requestedScoreView) ? requestedScoreView : 'subjects';
  const requestedPerspective = new URLSearchParams(location.search).get('perspective');
  const initialPerspective: ScorePerspective = requestedPerspective === 'classroom' ? 'classroom' : 'subject';

  const [perspective, setPerspective] = useState<ScorePerspective>(initialPerspective);
  const [activeAcademicTerm, setActiveAcademicTerm] = useState<'1' | '2' | 'yearly'>('1');
  const [hubClassroomFilter, setHubClassroomFilter] = useState<string>('all');
  const [schoolSubjects, setSchoolSubjects] = useState<SchoolSubject[]>(
    demoMode ? buildDemoSchoolSubjects(session.workspace?.id || 'demo-workspace', 'ป.5') : [],
  );
  const [isSubjectsBusy, setIsSubjectsBusy] = useState(false);
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
  const toolsMenuRef = useRef<HTMLDivElement>(null);
  const [cloneSourceClassroomId, setCloneSourceClassroomId] = useState('');
  const [cloneTargetClassroomIds, setCloneTargetClassroomIds] = useState<string[]>([]);

  const [classrooms, setClassrooms] = useState<ClassroomRow[]>(demoMode ? demoClassrooms : []);
  const [students, setStudents] = useState<StudentRow[]>(demoMode ? demoStudents : []);
  const [assessments, setAssessments] = useState<ScoreAssessmentRow[]>(demoMode ? demoAssessments : []);
  const [entries, setEntries] = useState<ScoreEntryRow[]>(demoMode ? demoEntries : []);
  const [classroomId, setClassroomId] = useState(demoMode ? demoClassrooms[0]?.id || '' : '');
  const [selectedAssessmentId, setSelectedAssessmentId] = useState(demoMode ? demoAssessments[0]?.id || '' : '');
  const [subjectFilter, setSubjectFilter] = useState(demoMode ? demoAssessments[0]?.subject_name || '' : '');
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
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [guideStep, setGuideStep] = useState(1);
  const [guideTab, setGuideTab] = useState<'tour' | 'manual'>('tour');
  const [isStickyRoster, setIsStickyRoster] = useState(true);
  const totalGuideSteps = 6;

  // Configurable score ratio synced to Supabase workspaces.settings (Default: 50 / 20 / 30)
  const [scoreRatio, setScoreRatio] = useState<{ coursework: number; midterm: number; final: number }>(() => {
    return getLocalScoreRatio(session.workspace?.id, undefined) || { coursework: 50, midterm: 20, final: 30 };
  });

  useEffect(() => {
    let active = true;
    const wsId = session.workspace?.id;
    const localCached = getLocalScoreRatio(wsId, subjectFilter);
    if (localCached) {
      setScoreRatio(localCached);
    }
    if (!wsId || demoMode) return;
    void loadCloudScoreRatio(wsId, subjectFilter).then((cloudRatio) => {
      if (active && cloudRatio) {
        setScoreRatio(cloudRatio);
      }
    });
    return () => {
      active = false;
    };
  }, [demoMode, session.workspace?.id, subjectFilter]);
  const [isRatioModalOpen, setIsRatioModalOpen] = useState(false);

  // Edit Assessment state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAssessment, setEditingAssessment] = useState<ScoreAssessmentRow | null>(null);
  const [editForm, setEditForm] = useState({
    assessmentDate: getTodayDate(),
    category: 'quiz' as AssessmentCategory,
    maxScore: '20',
    title: '',
    weight: '10',
  });

  const [isScoreOcrOpen, setIsScoreOcrOpen] = useState(false);
  const [isRubricModalOpen, setIsRubricModalOpen] = useState(false);
  const [isAcademicSubjectsOpen, setIsAcademicSubjectsOpen] = useState(false);
  const [isOfficialDocumentsOpen, setIsOfficialDocumentsOpen] = useState(false);
  const [isTermClosingOpen, setIsTermClosingOpen] = useState(false);

  function handleApplyScoreOcr(scs: Record<string, number | null>) {
    let appliedCount = 0;
    setScores((prev) => {
      const next = { ...prev };
      Object.entries(scs).forEach(([stdId, val]) => {
        if (val !== null && val !== undefined) {
          next[stdId] = String(val);
        }
      });
      return next;
    });
    if (selectedAssessment) {
      setGridScores((prev) => {
        const next = { ...prev };
        Object.entries(scs).forEach(([stdId, val]) => {
          if (val !== null && val !== undefined) {
            next[`${stdId}::${selectedAssessment.id}`] = String(val);
          }
        });
        return next;
      });
    }
    appliedCount = Object.values(scs).filter((val) => val !== null && val !== undefined).length;
    if (scoreView !== 'excel' && scoreView !== 'entry') {
      handleScoreViewChange(getDefaultEntryScoreView());
    }
    setNotice(
      `นำเข้าคะแนน "${selectedAssessment?.title || 'ชุดที่เลือก'}" จากภาพถ่ายสำเร็จ (${appliedCount} คน) กรุณาตรวจสอบและกดบันทึก`,
    );
  }

  const scoreBandConfigs = useMemo<
    Array<{
      description: string;
      key: ScoreBand;
      label: string;
      recommendedWeight: number;
    }>
  >(
    () => [
      {
        description: 'เก็บคะแนนย่อย ใบงาน โครงงาน และกิจกรรมระหว่างเรียน',
        key: 'coursework',
        label: 'ระหว่างเรียน',
        recommendedWeight: scoreRatio.coursework,
      },
      {
        description: 'คะแนนสอบกลางภาคของรายวิชานี้',
        key: 'midterm',
        label: 'กลางภาค',
        recommendedWeight: scoreRatio.midterm,
      },
      {
        description: 'คะแนนสอบปลายภาคของรายวิชานี้',
        key: 'final',
        label: 'ปลายภาค',
        recommendedWeight: scoreRatio.final,
      },
    ],
    [scoreRatio],
  );

  const teacherScope = useMemo(
    () => getTeacherClassroomScope(session, classrooms),
    [session, classrooms],
  );

  useEffect(() => {
    const nextScoreView: ScoreView = isScoreView(requestedScoreView) ? requestedScoreView : 'subjects';
    setScoreView((current) => (current === nextScoreView ? current : nextScoreView));
  }, [requestedScoreView]);

  useEffect(() => {
    if (!isToolsMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (event.target instanceof Node && !toolsMenuRef.current?.contains(event.target)) {
        setIsToolsMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsToolsMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isToolsMenuOpen]);

  const classroomById = useMemo(() => new Map(classrooms.map((classroom) => [classroom.id, classroom])), [classrooms]);

  const activeClassroom = useMemo(() => classroomById.get(classroomId) || classrooms[0] || null, [
    classroomById,
    classroomId,
    classrooms,
  ]);

  const classroomStudents = useMemo(() => {
    const rawClassroomStudents = students.filter((student) => student.classroom_id === classroomId);
    // In real workspaces (non-demo), strictly show only the workspace's real students
    if (!demoMode && session.workspace) {
      return rawClassroomStudents;
    }

    if (!activeClassroom) return rawClassroomStudents;

    const master = getPrimaryMasterData(activeClassroom.name);
    const expectedCodes = new Set(master.students.map((s) => s.student_code));

    // Filter students strictly belonging to this grade
    const validStudents = rawClassroomStudents.filter((s) => s.student_code && expectedCodes.has(s.student_code));

    // If some students belonging to this grade are currently assigned to another room (e.g. P.6 misplaced in P.5)
    if (validStudents.length < master.students.length) {
      const missingCodes = master.students
        .map((s) => s.student_code)
        .filter((code) => !validStudents.some((vs) => vs.student_code === code));

      const foundElsewhere = students.filter((s) => s.student_code && missingCodes.includes(s.student_code));
      if (foundElsewhere.length > 0) {
        validStudents.push(...foundElsewhere);
      }
    }

    if (validStudents.length > 0) {
      const codeOrder = new Map(master.students.map((s, idx) => [s.student_code, idx]));
      return validStudents.sort((a, b) => {
        const orderA = a.student_code ? codeOrder.get(a.student_code) ?? 999 : 999;
        const orderB = b.student_code ? codeOrder.get(b.student_code) ?? 999 : 999;
        return orderA - orderB;
      });
    }

    // Fallback if no students loaded yet (ONLY in standalone demo mode)
    if (demoMode) {
      return master.students.map((st) => ({
        id: `fallback-${st.student_code}`,
        student_code: st.student_code,
        first_name: st.first_name,
        last_name: st.last_name,
        nickname: st.first_name.slice(0, 3),
        classroom_id: classroomId,
      }));
    }

    return [];
  }, [activeClassroom, classroomId, demoMode, session.workspace, students]);

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
    schoolSubjects.forEach((sub) => {
      const name = sub.subject_name.trim();
      if (name) list.push(name);
    });
    if (form.subjectName.trim()) list.push(form.subjectName.trim());
    return Array.from(new Set(list)).sort((a, b) => a.localeCompare(b, 'th'));
  }, [assessments, form.subjectName, schoolSubjects]);

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
    if (classroomsWithSubject.length <= 1) return null;
    const idx = classroomsWithSubject.findIndex((c) => c.id === classroomId);
    if (idx >= 0 && idx < classroomsWithSubject.length - 1) {
      return classroomsWithSubject[idx + 1];
    }
    return null;
  }, [classroomsWithSubject, classroomId]);

  const subjectOptions = useMemo(
    () => (allWorkspaceSubjects.length > 0 ? allWorkspaceSubjects : [form.subjectName.trim() || 'คณิตศาสตร์']),
    [allWorkspaceSubjects, form.subjectName],
  );

  const activeSubjectMeta = useMemo(() => {
    const norm = subjectFilter.trim().toLowerCase();
    if (!norm) return null;
    const roomGrade = activeClassroom?.name?.split('/')[0]?.trim();
    const matches = schoolSubjects.filter(
      (sub) => sub.subject_name.trim().toLowerCase() === norm,
    );
    if (matches.length === 0) return null;
    if (roomGrade) {
      const exact = matches.find((sub) => sub.grade_level.trim() === roomGrade);
      if (exact) return exact;
    }
    return matches[0];
  }, [activeClassroom?.name, schoolSubjects, subjectFilter]);

  const contextAssessments = useMemo(
    () =>
      classroomAssessments.filter(
        (assessment) =>
          !subjectFilter ||
          assessment.subject_name.trim().toLowerCase() === subjectFilter.trim().toLowerCase(),
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

  const studentSeatNumberMap = useMemo(
    () => new Map(classroomStudents.map((student, index) => [student.id, index + 1])),
    [classroomStudents],
  );

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

  const subjectCards = useMemo<SubjectCardItem[]>(() => {
    const scopedClassroom =
      hubClassroomFilter !== 'all'
        ? classrooms.find((c) => c.id === hubClassroomFilter) || null
        : null;
    const scopedGradeLevel = scopedClassroom?.name?.split('/')[0]?.trim() || null;
    const preferredHubGrade =
      scopedGradeLevel ||
      teacherScope.homeroomClassrooms[0]?.name?.split('/')[0]?.trim() ||
      activeClassroom?.name?.split('/')[0]?.trim() ||
      null;

    const cardMap = new Map<
      string,
      {
        key: string;
        subjectName: string;
        subjectCode: string | null;
        learningArea: string | null;
        credit: number | null;
        hoursPerYear: number | null;
        gradeLevel: string | null;
        classroomMap: Map<string, { id: string; name: string }>;
        assessments: ScoreAssessmentRow[];
        hasOfficialRecord: boolean;
      }
    >();

    schoolSubjects.forEach((sub) => {
      if (scopedGradeLevel && sub.grade_level.trim() !== scopedGradeLevel) {
        return;
      }
      const key = sub.subject_name.trim().toLowerCase();
      if (!key) return;
      const existing = cardMap.get(key);
      if (!existing) {
        const roomMap = new Map<string, { id: string; name: string }>();
        if (scopedClassroom) {
          roomMap.set(scopedClassroom.id, { id: scopedClassroom.id, name: scopedClassroom.name });
        }
        cardMap.set(key, {
          key,
          subjectName: sub.subject_name.trim(),
          subjectCode: sub.subject_code.trim() || null,
          learningArea: sub.learning_area || null,
          credit: typeof sub.credit === 'number' ? sub.credit : Number(sub.credit) || null,
          hoursPerYear:
            typeof sub.hours_per_year === 'number'
              ? sub.hours_per_year
              : Number(sub.hours_per_year) || null,
          gradeLevel: sub.grade_level.trim() || null,
          classroomMap: roomMap,
          assessments: [],
          hasOfficialRecord: true,
        });
      } else if (preferredHubGrade && sub.grade_level.trim() === preferredHubGrade) {
        existing.subjectCode = sub.subject_code.trim() || existing.subjectCode;
        existing.learningArea = sub.learning_area || existing.learningArea;
        existing.credit = typeof sub.credit === 'number' ? sub.credit : Number(sub.credit) || existing.credit;
        existing.hoursPerYear =
          typeof sub.hours_per_year === 'number'
            ? sub.hours_per_year
            : Number(sub.hours_per_year) || existing.hoursPerYear;
        existing.gradeLevel = sub.grade_level.trim() || existing.gradeLevel;
      }
    });

    assessments
      .filter(
        (assessment) =>
          assessment.status !== 'archived' &&
          (hubClassroomFilter === 'all' || assessment.classroom_id === hubClassroomFilter),
      )
      .forEach((assessment) => {
        const cleanName = assessment.subject_name.trim();
        const key = cleanName.toLowerCase();
        if (!key) return;
        const room = classroomById.get(assessment.classroom_id);
        let target = cardMap.get(key);

        if (!target) {
          const fallbackMeta = schoolSubjects.find(
            (sub) => sub.subject_name.trim().toLowerCase() === key,
          );
          target = {
            key,
            subjectName: cleanName,
            subjectCode: fallbackMeta?.subject_code?.trim() || null,
            learningArea: fallbackMeta?.learning_area || null,
            credit: fallbackMeta ? Number(fallbackMeta.credit) || null : null,
            hoursPerYear: fallbackMeta ? Number(fallbackMeta.hours_per_year) || null : null,
            gradeLevel: fallbackMeta?.grade_level?.trim() || room?.name?.split('/')[0]?.trim() || null,
            classroomMap: new Map(),
            assessments: [],
            hasOfficialRecord: Boolean(fallbackMeta),
          };
          cardMap.set(key, target);
        }

        if (room) {
          target.classroomMap.set(room.id, { id: room.id, name: room.name });
        }
        target.assessments.push(assessment);
      });

    const studentCountByRoom = new Map<string, number>();
    students.forEach((student) => {
      if (student.classroom_id) {
        studentCountByRoom.set(student.classroom_id, (studentCountByRoom.get(student.classroom_id) || 0) + 1);
      }
    });

    return Array.from(cardMap.values())
      .map((item) => {
        const roomList = Array.from(item.classroomMap.values()).sort((a, b) =>
          a.name.localeCompare(b.name, 'th'),
        );

        const byRoom = new Map<string, ScoreAssessmentRow[]>();
        item.assessments.forEach((a) => {
          const list = byRoom.get(a.classroom_id) || [];
          list.push(a);
          byRoom.set(a.classroom_id, list);
        });
        let representativeAssessments: ScoreAssessmentRow[] = [];
        byRoom.forEach((list) => {
          if (list.length > representativeAssessments.length) {
            representativeAssessments = list;
          }
        });

        const plannedWeight = representativeAssessments.reduce((sum, a) => sum + a.weight, 0);

        let expectedEntries = 0;
        let filledEntries = 0;
        item.assessments.forEach((assessment) => {
          const roomStudents = studentCountByRoom.get(assessment.classroom_id) || 0;
          expectedEntries += roomStudents;
          filledEntries += (entriesByAssessment.get(assessment.id) || []).filter(
            (entry) => entry.score !== null && entry.score !== undefined,
          ).length;
        });

        const completionPercent =
          expectedEntries > 0 ? Math.min(100, Math.round((filledEntries / expectedEntries) * 100)) : 0;

        return {
          assessmentCount: representativeAssessments.length,
          classrooms: roomList,
          completionPercent,
          credit: item.credit,
          gradeLevel: item.gradeLevel,
          hasOfficialRecord: item.hasOfficialRecord,
          hoursPerYear: item.hoursPerYear,
          key: item.key,
          learningArea: item.learningArea,
          plannedWeight,
          subjectCode: item.subjectCode,
          subjectName: item.subjectName,
        };
      })
      .sort((a, b) => {
        if (a.assessmentCount > 0 && b.assessmentCount === 0) return -1;
        if (a.assessmentCount === 0 && b.assessmentCount > 0) return 1;
        if (a.subjectCode && b.subjectCode) {
          const codeCmp = a.subjectCode.localeCompare(b.subjectCode, 'th');
          if (codeCmp !== 0) return codeCmp;
        } else if (a.subjectCode && !b.subjectCode) {
          return -1;
        } else if (!a.subjectCode && b.subjectCode) {
          return 1;
        }
        return a.subjectName.localeCompare(b.subjectName, 'th');
      });
  }, [
    activeClassroom?.name,
    assessments,
    classroomById,
    classrooms,
    entriesByAssessment,
    hubClassroomFilter,
    schoolSubjects,
    students,
    teacherScope.homeroomClassrooms,
  ]);

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
        const bandAssessments = contextAssessments.filter((assessment) => getScoreBand(assessment) === band.key);
        const plannedWeight = bandAssessments.reduce((sum, assessment) => sum + assessment.weight, 0);
        const expectedEntries = bandAssessments.length * classroomStudents.length;
        const scoredEntries = bandAssessments.reduce(
          (sum, assessment) =>
            sum + (entriesByAssessment.get(assessment.id) || []).filter((entry) => entry.score !== null).length,
          0,
        );
        const assessmentAverages = bandAssessments
          .map((assessment) => {
            const assessmentEntries = (entriesByAssessment.get(assessment.id) || []).filter(
              (entry) => entry.score !== null,
            );
            if (assessmentEntries.length === 0) return null;
            const safeMax = assessment.max_score > 0 ? assessment.max_score : 100;
            return (
              assessmentEntries.reduce((entrySum, entry) => entrySum + ((entry.score || 0) / safeMax) * 100, 0) /
              assessmentEntries.length
            );
          })
          .filter((val): val is number => val !== null);

        const averagePercent =
          assessmentAverages.length > 0
            ? assessmentAverages.reduce((sum, val) => sum + val, 0) / assessmentAverages.length
            : 0;

        return {
          ...band,
          assessmentCount: bandAssessments.length,
          averagePercent,
          completePercent: expectedEntries > 0 ? Math.round((scoredEntries / expectedEntries) * 100) : 0,
          plannedWeight,
        };
      }),
    [classroomStudents.length, contextAssessments, entriesByAssessment, scoreBandConfigs],
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

        let scoredCount = 0;
        contextAssessments.forEach((assessment) => {
          const band = getScoreBand(assessment);
          const entry = (entriesByAssessment.get(assessment.id) || []).find((row) => row.student_id === student.id);
          bandScores[band].plannedWeight += assessment.weight;

          if (entry?.score !== null && entry?.score !== undefined) {
            scoredCount += 1;
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
          hasAnyScore: enteredWeight > 0 || scoredCount > 0,
          plannedWeight,
          student,
        };
      }),
    [classroomStudents, contextAssessments, entriesByAssessment, scoreBandConfigs],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadBaseData() {
      if (!supabase || !session.workspace || demoMode) {
        setClassrooms(demoClassrooms);
        setStudents(demoStudents);
        setAssessments(demoAssessments);
        setEntries(demoEntries);
        setSchoolSubjects(buildDemoSchoolSubjects(session.workspace?.id || 'demo-workspace', 'ป.5'));
        setClassroomId(demoClassrooms[0].id);
        setSubjectFilter(demoAssessments[0].subject_name);
        setSelectedAssessmentId(demoAssessments[0].id);
        setIsLoading(false);
        return;
      }

      const workspaceId = session.workspace.id;
      setIsLoading(true);
      setNotice(null);

      const [
        ,
        { data: classroomRows, error: classroomError },
        { data: studentRows, error: studentError },
        { data: assessmentRows, error: assessmentError },
        { data: termRows },
        subjectsRes,
      ] = await Promise.all([
        hydrateHiddenClassroomsFromCloud(session.profile.id, workspaceId),
        supabase
          .from('classrooms')
          .select('id,name,academic_year,homeroom_teacher_profile_id,status')
          .eq('workspace_id', workspaceId)
          .eq('status', 'active')
          .order('name', { ascending: true }),
        supabase
          .from('students')
          .select('id,student_code,first_name,last_name,nickname,classroom_id')
          .eq('workspace_id', workspaceId)
          .eq('status', 'active')
          .order('student_code', { ascending: true }),
        supabase
          .from('score_assessments')
          .select('id,workspace_id,classroom_id,title,subject_name,category,max_score,weight,assessment_date,status,created_by,metadata')
          .eq('workspace_id', workspaceId)
          .order('assessment_date', { ascending: false }),
        supabase
          .from('academic_terms')
          .select('term_name,is_current,status')
          .eq('workspace_id', workspaceId)
          .order('is_current', { ascending: false })
          .limit(5),
        supabase
          .from('school_subjects')
          .select(
            'id,workspace_id,subject_code,subject_name,learning_area,subject_type,grade_level,hours_per_year,hours_per_week,credit,teacher_profile_id,is_active,created_at,updated_at',
          )
          .eq('workspace_id', workspaceId)
          .eq('is_active', true)
          .order('subject_code', { ascending: true }),
      ]);

      if (!isMounted) return;

      if (classroomError || studentError || assessmentError) {
        setNotice(classroomError?.message || studentError?.message || assessmentError?.message || 'โหลดข้อมูลคะแนนไม่สำเร็จ');
        setIsLoading(false);
        return;
      }

      const rawClassrooms = (classroomRows || []) as ClassroomRow[];
      const nextStudents = (studentRows || []) as StudentRow[];
      const countsByClassroom = new Map<string, number>();
      nextStudents.forEach((student) => {
        if (student.classroom_id) {
          countsByClassroom.set(student.classroom_id, (countsByClassroom.get(student.classroom_id) || 0) + 1);
        }
      });
      const hiddenIds = getHiddenClassroomIds(workspaceId);
      const filteredClassrooms = rawClassrooms.filter(
        (c) =>
          !hiddenIds.has(c.id) &&
          !isObsoleteGhostClassroom(c, rawClassrooms, countsByClassroom, workspaceId),
      );
      const nextClassrooms = filteredClassrooms.length > 0 ? filteredClassrooms : rawClassrooms;

      const nextAssessments = (assessmentRows || []) as ScoreAssessmentRow[];
      const nextAssessmentIds = nextAssessments.map((assessment) => assessment.id);
      const initialScope = getTeacherClassroomScope(session, nextClassrooms);
      const preferredHomeroomId = initialScope.hasHomeroom ? initialScope.homeroomClassrooms[0].id : undefined;
      const nextClassroomId = getClassroomWithRoster(nextClassrooms, nextStudents, nextAssessments, preferredHomeroomId);
      const nextSelectedAssessmentId =
        nextAssessments.find((assessment) => assessment.classroom_id === nextClassroomId && assessment.status !== 'archived')?.id ||
        nextAssessments.find((assessment) => assessment.status !== 'archived')?.id ||
        '';

      const pickedTerm =
        (termRows || []).find((row) => row.is_current) ||
        (termRows || []).find((row) => row.status === 'open') ||
        termRows?.[0];
      setActiveAcademicTerm(parseActiveAcademicTerm(pickedTerm?.term_name));

      const preferredGradeHint =
        nextClassrooms.find((c) => c.id === nextClassroomId)?.name?.split('/')[0] ||
        nextClassrooms[0]?.name?.split('/')[0];
      const loadedSubjects: SchoolSubject[] =
        !subjectsRes.error && subjectsRes.data && subjectsRes.data.length > 0
          ? (subjectsRes.data as SchoolSubject[])
          : readCachedSchoolSubjects(workspaceId, preferredGradeHint);

      let nextEntries: ScoreEntryRow[] = [];
      if (nextAssessmentIds.length > 0) {
        const assessmentIdSet = new Set(nextAssessmentIds);
        const PAGE_SIZE = 1000;
        const MAX_PAGES = 25;
        const collectedEntries: ScoreEntryRow[] = [];

        for (let page = 0; page < MAX_PAGES; page += 1) {
          const from = page * PAGE_SIZE;
          const to = from + PAGE_SIZE - 1;
          const { data: entryRows, error: entryError } = await supabase
            .from('score_entries')
            .select('id,assessment_id,student_id,score,note')
            .eq('workspace_id', workspaceId)
            .order('id', { ascending: true })
            .range(from, to);

          if (!isMounted) return;

          if (entryError) {
            setNotice(entryError.message);
            setIsLoading(false);
            return;
          }

          const batch = (entryRows || []) as ScoreEntryRow[];
          collectedEntries.push(...batch);
          if (batch.length < PAGE_SIZE) break;
        }

        nextEntries = collectedEntries.filter((row) => assessmentIdSet.has(row.assessment_id));
      }

      setClassrooms(nextClassrooms);
      setStudents(nextStudents);
      setAssessments(nextAssessments);
      setEntries(nextEntries);
      setSchoolSubjects(loadedSubjects);
      setClassroomId(nextClassroomId);
      setSubjectFilter(
        nextAssessments.find((assessment) => assessment.id === nextSelectedAssessmentId)?.subject_name ||
          loadedSubjects[0]?.subject_name ||
          '',
      );
      setSelectedAssessmentId(nextSelectedAssessmentId);
      setIsLoading(false);
    }

    void loadBaseData();

    return () => {
      isMounted = false;
    };
  }, [demoMode, session.profile.id, session.workspace?.id]);

  async function reloadSchoolSubjects() {
    if (!supabase || !session.workspace || demoMode) return;
    const workspaceId = session.workspace.id;
    const { data, error } = await supabase
      .from('school_subjects')
      .select(
        'id,workspace_id,subject_code,subject_name,learning_area,subject_type,grade_level,hours_per_year,hours_per_week,credit,teacher_profile_id,is_active,created_at,updated_at',
      )
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .order('subject_code', { ascending: true });

    if (!error && data && data.length > 0) {
      setSchoolSubjects(data as SchoolSubject[]);
      return;
    }

    const cached = readCachedSchoolSubjects(workspaceId, activeClassroom?.name?.split('/')[0]);
    if (cached.length > 0) {
      setSchoolSubjects(cached);
    }
  }

  async function handleQuickAddSubject(payload: {
    subjectCode: string;
    subjectName: string;
    learningArea: string;
    credit: number;
    hoursPerYear: number;
    gradeLevel: string;
  }): Promise<boolean> {
    const workspaceId = session.workspace?.id || 'demo-workspace';
    const targetClassroomId =
      hubClassroomFilter !== 'all'
        ? hubClassroomFilter
        : teacherScope.hasHomeroom
          ? teacherScope.homeroomClassrooms[0].id
          : classroomId || classrooms[0]?.id || '';

    const hoursPerWeek = Number((payload.hoursPerYear / 40).toFixed(1));
    const newSubjectRecord: SchoolSubject = {
      id: `local-sub-${Date.now()}`,
      workspace_id: workspaceId,
      subject_code: payload.subjectCode,
      subject_name: payload.subjectName,
      learning_area: payload.learningArea,
      subject_type: 'basic',
      grade_level: payload.gradeLevel,
      hours_per_year: payload.hoursPerYear,
      hours_per_week: hoursPerWeek,
      credit: payload.credit,
      teacher_profile_id: session.profile.id,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const openCreatedSubject = (saved: SchoolSubject) => {
      setSchoolSubjects((prev) => {
        const withoutDup = prev.filter(
          (item) =>
            !(
              item.subject_name.trim().toLowerCase() === saved.subject_name.trim().toLowerCase() &&
              item.grade_level.trim() === saved.grade_level.trim()
            ),
        );
        return [saved, ...withoutDup];
      });
      setSubjectFilter(saved.subject_name);
      if (targetClassroomId) setClassroomId(targetClassroomId);
      const existingAssessment = assessments.find(
        (a) =>
          a.classroom_id === targetClassroomId &&
          a.status !== 'archived' &&
          a.subject_name.trim().toLowerCase() === saved.subject_name.trim().toLowerCase(),
      );
      setSelectedAssessmentId(existingAssessment?.id || '');
      handleScoreViewChange(getDefaultEntryScoreView());
    };

    if (!supabase || !session.workspace || demoMode) {
      openCreatedSubject(newSubjectRecord);
      setNotice(`เพิ่มรายวิชา "${payload.subjectName} (${payload.subjectCode})" แล้ว`);
      return true;
    }

    setIsSubjectsBusy(true);
    setNotice(null);
    try {
      const upsertPayload = {
        workspace_id: workspaceId,
        subject_code: payload.subjectCode,
        subject_name: payload.subjectName,
        learning_area: payload.learningArea,
        subject_type: 'basic' as const,
        grade_level: payload.gradeLevel,
        hours_per_year: payload.hoursPerYear,
        hours_per_week: hoursPerWeek,
        credit: payload.credit,
        teacher_profile_id: session.profile.id,
        is_active: true,
      };

      const { data, error } = await supabase
        .from('school_subjects')
        .upsert(upsertPayload, { onConflict: 'workspace_id,subject_code,grade_level' })
        .select(
          'id,workspace_id,subject_code,subject_name,learning_area,subject_type,grade_level,hours_per_year,hours_per_week,credit,teacher_profile_id,is_active,created_at,updated_at',
        )
        .single();

      if (error) {
        if (error.message?.includes('Could not find the table')) {
          try {
            const key = `classcare_academic_subjects_${workspaceId}_${payload.gradeLevel}`;
            const existing = readCachedSchoolSubjects(workspaceId, payload.gradeLevel);
            window.localStorage.setItem(key, JSON.stringify([newSubjectRecord, ...existing]));
          } catch {
            // Ignore localStorage fallback failure.
          }
          openCreatedSubject(newSubjectRecord);
          setNotice(`เพิ่มรายวิชา "${payload.subjectName} (${payload.subjectCode})" ลงคลังชั่วคราวแล้ว`);
          return true;
        }
        setNotice(error.message || 'เพิ่มรายวิชาไม่สำเร็จ');
        return false;
      }

      const savedSubject = data as SchoolSubject;
      await writeAuditLog(session, {
        action: 'academic.quick_add_subject',
        entityId: savedSubject.id,
        entityTable: 'school_subjects',
        metadata: {
          grade_level: savedSubject.grade_level,
          subject_code: savedSubject.subject_code,
          subject_name: savedSubject.subject_name,
        },
        riskLevel: 'low',
        source: 'score_center',
      });
      openCreatedSubject(savedSubject);
      setNotice(`เพิ่มรายวิชา "${savedSubject.subject_name} (${savedSubject.subject_code})" แล้ว`);
      return true;
    } finally {
      setIsSubjectsBusy(false);
    }
  }

  async function handleLoadObecDefaultSubjects() {
    const workspaceId = session.workspace?.id || 'demo-workspace';
    const scopedRoom =
      hubClassroomFilter !== 'all'
        ? classrooms.find((c) => c.id === hubClassroomFilter)
        : teacherScope.hasHomeroom
          ? teacherScope.homeroomClassrooms[0]
          : activeClassroom;
    const gradeLevel = scopedRoom?.name?.split('/')[0]?.trim() || 'ป.5';

    const templateRows = DEFAULT_PRIMARY_SUBJECTS_TEMPLATE.map((tpl) => ({
      workspace_id: workspaceId,
      subject_code: adaptObecSubjectCode(tpl.code, gradeLevel),
      subject_name: tpl.name,
      learning_area: tpl.area,
      subject_type: 'basic' as const,
      grade_level: gradeLevel,
      hours_per_year: tpl.hours,
      hours_per_week: Number((tpl.hours / 40).toFixed(1)),
      credit: tpl.credit,
      teacher_profile_id: session.profile.id,
      is_active: true,
    }));

    if (!supabase || !session.workspace || demoMode) {
      setSchoolSubjects(
        templateRows.map((row, idx) => ({
          ...row,
          id: `demo-sub-${Date.now()}-${idx}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })),
      );
      setNotice(`โหลด 9 รายวิชาครบ 8 กลุ่มสาระ สพฐ. (${gradeLevel}) แล้ว`);
      return;
    }

    setIsSubjectsBusy(true);
    setNotice(null);
    try {
      const { data, error } = await supabase
        .from('school_subjects')
        .upsert(templateRows, { onConflict: 'workspace_id,subject_code,grade_level' })
        .select(
          'id,workspace_id,subject_code,subject_name,learning_area,subject_type,grade_level,hours_per_year,hours_per_week,credit,teacher_profile_id,is_active,created_at,updated_at',
        );

      if (error) {
        if (error.message?.includes('Could not find the table')) {
          const fallbackList = templateRows.map((row, idx) => ({
            ...row,
            id: `local-sub-${Date.now()}-${idx}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })) as SchoolSubject[];
          try {
            window.localStorage.setItem(
              `classcare_academic_subjects_${workspaceId}_${gradeLevel}`,
              JSON.stringify(fallbackList),
            );
          } catch {
            // Ignore localStorage failure.
          }
          setSchoolSubjects(fallbackList);
          setNotice(`โหลดแม่แบบ 8 กลุ่มสาระ (${gradeLevel}) ลงคลังชั่วคราวแล้ว`);
          return;
        }
        setNotice(error.message || 'โหลดรายวิชาพื้นฐาน สพฐ. ไม่สำเร็จ');
        return;
      }

      const savedRows = (data || []) as SchoolSubject[];
      setSchoolSubjects((prev) => {
        const map = new Map(prev.map((item) => [`${item.subject_code}::${item.grade_level}`, item]));
        savedRows.forEach((row) => map.set(`${row.subject_code}::${row.grade_level}`, row));
        return Array.from(map.values()).sort((a, b) => a.subject_code.localeCompare(b.subject_code));
      });
      await writeAuditLog(session, {
        action: 'academic.import_default_subjects_template',
        entityId: workspaceId,
        entityTable: 'school_subjects',
        metadata: { count: savedRows.length, gradeLevel },
        riskLevel: 'low',
        source: 'score_center',
      });
      setNotice(`โหลด 9 รายวิชาครบ 8 กลุ่มสาระ สพฐ. (${gradeLevel}) พร้อมรหัสวิชาแล้ว`);
    } finally {
      setIsSubjectsBusy(false);
    }
  }

  function handleOpenSubjectFromHub(card: SubjectCardItem) {
    const targetRoomId =
      hubClassroomFilter !== 'all'
        ? hubClassroomFilter
        : card.classrooms[0]?.id ||
          (teacherScope.hasHomeroom ? teacherScope.homeroomClassrooms[0].id : classrooms[0]?.id || classroomId);

    const matchingAssessment = assessments.find(
      (a) =>
        a.classroom_id === targetRoomId &&
        a.status !== 'archived' &&
        a.subject_name.trim().toLowerCase() === card.subjectName.trim().toLowerCase(),
    );

    setSubjectFilter(card.subjectName);
    if (targetRoomId) setClassroomId(targetRoomId);
    setSelectedAssessmentId(matchingAssessment?.id || '');
    handleScoreViewChange(getDefaultEntryScoreView());
  }

  function openCreateAssessmentModal(overrideClassroomId?: string) {
    const targetCid = overrideClassroomId || classroomId;
    setForm((current) => ({
      ...current,
      subjectName: subjectFilter || current.subjectName,
      targetClassroomIds: targetCid ? [targetCid] : [],
    }));
    setIsCreateModalOpen(true);
  }

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

      const targetCreated = newItems.find((item) => item.classroom_id === classroomId) || newItems[0];
      setAssessments((current) => [...newItems, ...current]);
      setSubjectFilter(subjectName);
      if (targetCreated) setSelectedAssessmentId(targetCreated.id);
      setForm((current) => ({ ...current, targetClassroomIds: [], title: '' }));
      setIsCreateModalOpen(false);
      if (scoreView !== 'excel' && scoreView !== 'entry') {
        handleScoreViewChange(getDefaultEntryScoreView());
      }
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

    let insertResult = await supabase
      .from('score_assessments')
      .insert(payload)
      .select('id,workspace_id,classroom_id,title,subject_name,category,max_score,weight,assessment_date,status,created_by,metadata');

    // Resilient fallback: If database constraint doesn't have 'midterm' or 'final' yet (migration 0017 not run)
    if (insertResult.error && insertResult.error.message.includes('score_assessments_category_check')) {
      const fallbackPayload = payload.map((p) => {
        if (p.category === 'midterm' || p.category === 'final') {
          return {
            ...p,
            category: 'exam' as AssessmentCategory,
            metadata: {
              exam_type: p.category,
              original_category: p.category,
            },
          };
        }
        return p;
      });
      insertResult = await supabase
        .from('score_assessments')
        .insert(fallbackPayload)
        .select('id,workspace_id,classroom_id,title,subject_name,category,max_score,weight,assessment_date,status,created_by,metadata');
    }

    if (insertResult.error) {
      setNotice(insertResult.error.message);
      setIsSubmitting(false);
      return;
    }

    const createdList = (insertResult.data || []) as ScoreAssessmentRow[];
    const targetCreated = createdList.find((item) => item.classroom_id === classroomId) || createdList[0];
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
    if (targetCreated) setSelectedAssessmentId(targetCreated.id);
    setForm((current) => ({ ...current, targetClassroomIds: [], title: '' }));
    setIsCreateModalOpen(false);
    if (scoreView !== 'excel' && scoreView !== 'entry') {
      handleScoreViewChange(getDefaultEntryScoreView());
    }
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

  function enqueueScoreEntriesOffline(
    rows: Array<{
      assessment_id: string;
      note: string | null;
      score: number | null;
      student_id: string;
      workspace_id: string;
    }>,
    label: string,
  ) {
    const wsId = session.workspace?.id || rows[0]?.workspace_id;
    if (!wsId || rows.length === 0) return;

    enqueueOfflineMutation({
      kind: 'score_entries_batch',
      label,
      payload: {
        entries: rows.map((row) => ({
          assessment_id: row.assessment_id,
          note: row.note,
          score: row.score,
          student_id: row.student_id,
          workspace_id: wsId,
        })),
      },
      workspaceId: wsId,
    });

    setEntries((current) => {
      const updatedMap = new Map(current.map((item) => [`${item.student_id}::${item.assessment_id}`, item]));
      rows.forEach((row) => {
        const key = `${row.student_id}::${row.assessment_id}`;
        const existing = updatedMap.get(key);
        updatedMap.set(key, {
          assessment_id: row.assessment_id,
          id: existing?.id || `offline-score-${row.student_id}-${row.assessment_id}`,
          note: row.note,
          score: row.score,
          student_id: row.student_id,
        });
      });
      return Array.from(updatedMap.values());
    });
    setNotice(`ไม่มีอินเทอร์เน็ต — พัก ${rows.length} รายการคะแนนลงคิวออฟไลน์แล้ว ระบบจะซิงก์อัตโนมัติเมื่อเชื่อมต่อ`);
    setIsSubmitting(false);
  }

  async function handleSaveScores(): Promise<boolean> {
    if (!selectedAssessment) return false;

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
      return false;
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
      return true;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      enqueueScoreEntriesOffline(payload, `บันทึกคะแนน: ${selectedAssessment.title}`);
      return true;
    }

    const { data, error } = await supabase
      .from('score_entries')
      .upsert(payload, { onConflict: 'assessment_id,student_id' })
      .select('id,assessment_id,student_id,score,note');

    if (error) {
      if (isLikelyNetworkError(error)) {
        enqueueScoreEntriesOffline(payload, `บันทึกคะแนน: ${selectedAssessment.title}`);
        return true;
      }
      setNotice(error.message);
      setIsSubmitting(false);
      return false;
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
    return true;
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

  function openEditModal(assessment: ScoreAssessmentRow) {
    setEditingAssessment(assessment);
    setEditForm({
      assessmentDate: assessment.assessment_date,
      category: assessment.category,
      maxScore: String(assessment.max_score),
      title: assessment.title,
      weight: String(assessment.weight),
    });
    setIsEditModalOpen(true);
  }

  async function handleSaveEditAssessment(event: FormEvent) {
    event.preventDefault();
    if (!editingAssessment) return;
    const maxScore = Number(editForm.maxScore);
    const weight = Number(editForm.weight);
    if (!Number.isFinite(maxScore) || maxScore <= 0 || !Number.isFinite(weight) || weight <= 0) {
      setNotice('คะแนนเต็มและน้ำหนักคะแนนต้องเป็นตัวเลขที่มากกว่า 0');
      return;
    }

    setIsSubmitting(true);
    setNotice(null);

    const updatedFields = {
      assessment_date: editForm.assessmentDate,
      category: editForm.category,
      max_score: maxScore,
      title: editForm.title.trim() || editingAssessment.title,
      weight,
    };

    if (!supabase || !session.workspace || isDemoSession(session)) {
      setAssessments((current) =>
        current.map((item) => (item.id === editingAssessment.id ? { ...item, ...updatedFields } : item)),
      );
      setIsEditModalOpen(false);
      setNotice('แก้ไขชุดคะแนนเรียบร้อยแล้ว [โหมดตัวอย่าง]');
      setIsSubmitting(false);
      return;
    }

    let updateRes = await supabase
      .from('score_assessments')
      .update(updatedFields)
      .eq('id', editingAssessment.id)
      .eq('workspace_id', session.workspace.id);

    if (updateRes.error && updateRes.error.message.includes('score_assessments_category_check')) {
      updateRes = await supabase
        .from('score_assessments')
        .update({
          ...updatedFields,
          category: 'exam' as AssessmentCategory,
          metadata: {
            ...((editingAssessment.metadata as Record<string, unknown>) || {}),
            exam_type: editForm.category,
            original_category: editForm.category,
          },
        })
        .eq('id', editingAssessment.id)
        .eq('workspace_id', session.workspace.id);
    }

    if (updateRes.error) {
      setNotice(updateRes.error.message);
      setIsSubmitting(false);
      return;
    }

    await writeAuditLog(session, {
      action: 'score_assessment.updated',
      entityId: editingAssessment.id,
      entityTable: 'score_assessments',
      metadata: {
        category: editForm.category,
        max_score: maxScore,
        title: updatedFields.title,
        weight,
      },
      riskLevel: 'normal',
      source: 'score_center',
    });

    setAssessments((current) =>
      current.map((item) => (item.id === editingAssessment.id ? { ...item, ...updatedFields } : item)),
    );
    setIsEditModalOpen(false);
    setNotice('แก้ไขชุดคะแนนเรียบร้อยแล้ว');
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

  function confirmDiscardUnsavedChanges(): boolean {
    const pending =
      scoreView === 'excel'
        ? unsavedGridCount
        : scoreView === 'entry'
          ? unsavedCount
          : 0;
    if (pending <= 0) return true;
    return window.confirm(
      `คุณมีคะแนนที่แก้ไขค้างอยู่ ${pending} รายการและยังไม่ได้กดบันทึก\nต้องการเปลี่ยนหน้าโดยไม่บันทึกใช่หรือไม่?`,
    );
  }

  useEffect(() => {
    const hasPending =
      (scoreView === 'excel' && unsavedGridCount > 0) ||
      (scoreView === 'entry' && unsavedCount > 0);
    if (!hasPending) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [scoreView, unsavedCount, unsavedGridCount]);

  function handleScoreViewChange(nextScoreView: ScoreView) {
    if (nextScoreView === scoreView) return;
    if (!confirmDiscardUnsavedChanges()) return;
    setScoreView(nextScoreView);
    navigate(withDemoContext(`/app/dashboard?view=scores&scoreView=${nextScoreView}&perspective=${perspective}`, location.search), { replace: true });
  }

  function handlePerspectiveChange(nextPerspective: ScorePerspective) {
    if (nextPerspective === perspective) return;
    if (!confirmDiscardUnsavedChanges()) return;
    setPerspective(nextPerspective);
    try {
      window.localStorage.setItem(SCORES_PERSPECTIVE_STORAGE_KEY, nextPerspective);
    } catch {
      // Ignore storage write errors.
    }
    const params = new URLSearchParams(location.search);
    params.set('perspective', nextPerspective);
    if (!params.get('scoreView')) {
      params.set('scoreView', scoreView);
    }
    navigate(withDemoContext(`/app/dashboard?${params.toString()}`, location.search), { replace: true });
  }

  // Save all changes in Excel Grid across all assessments
  async function handleSaveGridScores(): Promise<boolean> {
    if (contextAssessments.length === 0 || classroomStudents.length === 0) return false;
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
          return false;
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
      return true;
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
      return true;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      enqueueScoreEntriesOffline(payload, `ตารางคะแนนรวม ${subjectFilter || activeClassroom?.name || ''}`);
      return true;
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
      if (isLikelyNetworkError(error)) {
        enqueueScoreEntriesOffline(payload, `ตารางคะแนนรวม ${subjectFilter || activeClassroom?.name || ''}`);
        return true;
      }
      setNotice(error.message);
      setIsSubmitting(false);
      return false;
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
    return true;
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

  const { remedialQueueRows, missingCountByStudent } = useMemo(() => {
    const missingMap = new Map<string, number>();
    if (contextAssessments.length === 0) {
      return {
        missingCountByStudent: missingMap,
        remedialQueueRows: [] as Array<
          (typeof studentGradebookRows)[number] & {
            academicStatus: 'incomplete_r' | 'fail_0';
            missingAssessments: ScoreAssessmentRow[];
          }
        >,
      };
    }

    const queue: Array<
      (typeof studentGradebookRows)[number] & {
        academicStatus: 'incomplete_r' | 'fail_0';
        missingAssessments: ScoreAssessmentRow[];
      }
    > = [];

    studentGradebookRows.forEach((row) => {
      const missingAssessments = contextAssessments.filter((assessment) => {
        const entry = (entriesByAssessment.get(assessment.id) || []).find(
          (item) => item.student_id === row.student.id,
        );
        return entry?.score === null || entry?.score === undefined;
      });
      missingMap.set(row.student.id, missingAssessments.length);

      if (missingAssessments.length > 0) {
        queue.push({ ...row, academicStatus: 'incomplete_r', missingAssessments });
      } else if (row.hasAnyScore && row.plannedWeight > 0 && row.finalPercent < 50) {
        queue.push({ ...row, academicStatus: 'fail_0', missingAssessments: [] });
      }
    });

    return { missingCountByStudent: missingMap, remedialQueueRows: queue };
  }, [contextAssessments, entriesByAssessment, studentGradebookRows]);

  const incompleteRCount = useMemo(
    () => remedialQueueRows.filter((row) => row.academicStatus === 'incomplete_r').length,
    [remedialQueueRows],
  );
  const fail0Count = useMemo(
    () => remedialQueueRows.filter((row) => row.academicStatus === 'fail_0').length,
    [remedialQueueRows],
  );

  const homeroomIdSet = useMemo(
    () => new Set(teacherScope.homeroomClassrooms.map((room) => room.id)),
    [teacherScope.homeroomClassrooms],
  );
  const defaultHubGradeLevel =
    teacherScope.homeroomClassrooms[0]?.name?.split('/')[0]?.trim() ||
    activeClassroom?.name?.split('/')[0]?.trim() ||
    'ป.5';

  return (
    <main className="app-page pb-24">
      {scoreView === 'subjects' ? (
        <>
          {notice ? (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-xs font-black text-cyan-900 shadow-sm animate-fade-in">
              <div className="flex items-center gap-2">
                <AlertTriangle className="shrink-0 text-cyan-700" size={16} aria-hidden="true" />
                <p>{notice}</p>
              </div>
              <button
                className="text-xs text-cyan-700 underline hover:text-cyan-950"
                onClick={() => setNotice(null)}
                type="button"
              >
                ปิด
              </button>
            </div>
          ) : null}

          <SubjectCardsHub
            cards={subjectCards}
            classrooms={classrooms.map((room) => ({
              academic_year: room.academic_year,
              id: room.id,
              isHomeroom: homeroomIdSet.has(room.id),
              name: room.name,
              studentCount: students.filter((s) => s.classroom_id === room.id).length,
            }))}
            defaultGradeLevel={defaultHubGradeLevel}
            hasOfficialSubjects={schoolSubjects.length > 0}
            isBusy={isSubjectsBusy || isSubmitting}
            isLoadingSubjects={isLoading}
            onLoadObecDefaults={handleLoadObecDefaultSubjects}
            onOpenAcademicSubjectsModal={() => setIsAcademicSubjectsOpen(true)}
            onOpenGuide={() => setIsGuideOpen(true)}
            onOpenOfficialDocuments={() => setIsOfficialDocumentsOpen(true)}
            onOpenRubricModal={() => setIsRubricModalOpen(true)}
            onOpenSubject={handleOpenSubjectFromHub}
            onOpenTermClosing={() => setIsTermClosingOpen(true)}
            onQuickAddSubject={handleQuickAddSubject}
            onSelectClassroomFilter={setHubClassroomFilter}
            selectedClassroomId={hubClassroomFilter}
          />
        </>
      ) : (
        <>
          {/* STAGE 2: Compact 2-Bar Subject Score Workspace Header */}
          <section
            aria-label="แถบข้อมูลรายวิชาและการสลับห้องเรียน"
            className="rounded-2xl border border-[#E5E8E1] bg-white px-3.5 py-2.5 shadow-sm"
          >
            {/* Bar 1: Back + Subject Identity + Classroom Switcher + Primary Actions */}
            <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => handleScoreViewChange('subjects')}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl border border-[#DCE3D7] bg-[#FAFBF8] px-2.5 text-xs font-black text-[#1C342B] transition hover:border-[#2F7D5B] hover:bg-[#EAF5EF]"
                >
                  <ArrowLeft size={14} aria-hidden="true" />
                  <span>รายวิชา</span>
                </button>

                <span className="hidden h-5 w-px bg-slate-200 sm:inline-block" aria-hidden="true" />

                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                  <h1 className="truncate font-display text-base font-black text-[#1F2924] sm:text-lg">
                    {subjectFilter || 'เลือกรายวิชา'}
                  </h1>
                  {activeSubjectMeta?.subject_code ? (
                    <span className="rounded-md border border-cyan-200 bg-cyan-50 px-1.5 py-0.5 font-mono text-[11px] font-black text-cyan-900">
                      {activeSubjectMeta.subject_code}
                    </span>
                  ) : null}
                  {activeSubjectMeta?.credit ? (
                    <span className="rounded-full bg-[#EFF3EC] px-2 py-0.5 text-[11px] font-bold text-[#4C5751]">
                      {activeSubjectMeta.credit.toFixed(2)} นก.
                    </span>
                  ) : null}
                </div>

                <span className="hidden h-5 w-px bg-slate-200 md:inline-block" aria-hidden="true" />

                {/* Inline Classroom Switcher Pills */}
                <div className="flex flex-wrap items-center gap-1">
                  <Users size={13} className="mr-0.5 text-slate-400 shrink-0" aria-hidden="true" />
                  {classroomsWithSubject.map((c) => {
                    const count = students.filter((s) => s.classroom_id === c.id).length;
                    const isSelected = classroomId === c.id;
                    const isRoomHomeroom = homeroomIdSet.has(c.id);
                    return (
                      <button
                        key={c.id}
                        className={`inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-black transition ${
                          isSelected
                            ? 'bg-slate-950 text-white shadow-2xs ring-1 ring-slate-900'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80 hover:text-slate-900'
                        }`}
                        onClick={() => {
                          if (c.id !== classroomId && !confirmDiscardUnsavedChanges()) return;
                          setClassroomId(c.id);
                        }}
                        type="button"
                      >
                        <span>
                          {isRoomHomeroom ? '★ ' : ''}
                          {c.name}
                        </span>
                        <span
                          className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-white text-slate-500'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}

                  {availableClassroomsToAdd.length > 0 ? (
                    <select
                      className="h-7 rounded-lg border border-dashed border-slate-300 bg-white px-2 text-[11px] font-bold text-slate-600 outline-none hover:border-cyan-500 focus:border-cyan-600"
                      onChange={(e) => {
                        const cid = e.target.value;
                        if (!cid) return;
                        if (cid !== classroomId && !confirmDiscardUnsavedChanges()) return;
                        setClassroomId(cid);
                        openCreateAssessmentModal(cid);
                      }}
                      value=""
                    >
                      <option value="">+ เพิ่มห้อง</option>
                      {availableClassroomsToAdd.map((c) => (
                        <option key={c.id} value={c.id}>
                          + ห้อง {c.name}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                <button
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl bg-cyan-600 px-3 text-xs font-black text-white shadow-2xs transition hover:bg-cyan-700"
                  onClick={() => openCreateAssessmentModal()}
                  type="button"
                >
                  <Plus size={14} aria-hidden="true" />
                  <span>เพิ่มช่องคะแนน</span>
                </button>

                <Link
                  to={`/app/dashboard?view=omr-scanner&classroomId=${encodeURIComponent(classroomId || '')}&subjectName=${encodeURIComponent(subjectFilter || '')}${selectedAssessment?.id ? `&assessmentId=${encodeURIComponent(selectedAssessment.id)}` : ''}`}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl border border-cyan-300 bg-cyan-50/80 px-2.5 text-xs font-black text-cyan-900 shadow-2xs transition hover:border-cyan-400 hover:bg-cyan-100"
                  title="เปิดระบบออกแบบและตรวจกระดาษคำตอบ OMR ด้วยกล้อง"
                >
                  <Camera size={13} className="text-cyan-700" aria-hidden="true" />
                  <span>ตรวจ OMR</span>
                </Link>

                <div className="relative" ref={toolsMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsToolsMenuOpen((open) => !open)}
                    aria-expanded={isToolsMenuOpen}
                    aria-haspopup="menu"
                    className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-black transition ${
                      isToolsMenuOpen
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Settings2 size={13} aria-hidden="true" />
                    <span>เครื่องมือ</span>
                    <ChevronDown
                      size={13}
                      className={`transition-transform ${isToolsMenuOpen ? 'rotate-180' : ''}`}
                      aria-hidden="true"
                    />
                  </button>

                  {isToolsMenuOpen ? (
                    <div
                      role="menu"
                      aria-label="เครื่องมือเพิ่มเติมระบบคะแนน"
                      className="absolute right-0 top-[calc(100%+0.45rem)] z-40 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"
                    >
                      {selectedAssessment ? (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setIsToolsMenuOpen(false);
                            setIsScoreOcrOpen(true);
                          }}
                          className="flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left transition hover:bg-slate-50"
                        >
                          <Camera size={15} className="mt-0.5 shrink-0 text-indigo-600" aria-hidden="true" />
                          <span className="min-w-0">
                            <span className="block text-xs font-black text-slate-900">สแกนใบคะแนน AI</span>
                            <span className="block text-[11px] font-medium text-slate-500">ถ่ายภาพใบคะแนนเพื่อกรอกอัตโนมัติ</span>
                          </span>
                        </button>
                      ) : null}

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setIsToolsMenuOpen(false);
                          setIsRubricModalOpen(true);
                        }}
                        className="flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left transition hover:bg-slate-50"
                      >
                        <Sparkles size={15} className="mt-0.5 shrink-0 text-violet-600" aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block text-xs font-black text-slate-900">สร้างข้อสอบ &amp; รูบริก AI</span>
                          <span className="block text-[11px] font-medium text-slate-500">ออกแบบข้อสอบและเกณฑ์ประเมิน</span>
                        </span>
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setIsToolsMenuOpen(false);
                          setIsOfficialDocumentsOpen(true);
                        }}
                        className="flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left transition hover:bg-slate-50"
                      >
                        <FileSpreadsheet size={15} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block text-xs font-black text-slate-900">พิมพ์ ปพ.๕ / ปพ.๖</span>
                          <span className="block text-[11px] font-medium text-slate-500">ออกเอกสารทางการและใบรับรอง</span>
                        </span>
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setIsToolsMenuOpen(false);
                          setIsTermClosingOpen(true);
                        }}
                        className="flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left transition hover:bg-slate-50"
                      >
                        <Lock size={15} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block text-xs font-black text-slate-900">ปิดเทอม &amp; เลื่อนชั้น</span>
                          <span className="block text-[11px] font-medium text-slate-500">ตรวจความพร้อมและล็อกผลการเรียน</span>
                        </span>
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setIsToolsMenuOpen(false);
                          setIsAcademicSubjectsOpen(true);
                        }}
                        className="flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left transition hover:bg-slate-50"
                      >
                        <BookOpen size={15} className="mt-0.5 shrink-0 text-blue-600" aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block text-xs font-black text-slate-900">โครงสร้างวิชา &amp; ตัดเกรด</span>
                          <span className="block text-[11px] font-medium text-slate-500">กำหนดรหัสวิชา 8 กลุ่มสาระและเกณฑ์ 0–4</span>
                        </span>
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setIsToolsMenuOpen(false);
                          setCloneSourceClassroomId(classroomsWithSubject[0]?.id || classroomId);
                          const otherClassrooms = classrooms.filter(
                            (c) => c.id !== (classroomsWithSubject[0]?.id || classroomId),
                          );
                          setCloneTargetClassroomIds(otherClassrooms.map((c) => c.id));
                          setIsCloneModalOpen(true);
                        }}
                        className="flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left transition hover:bg-slate-50"
                      >
                        <Copy size={15} className="mt-0.5 shrink-0 text-indigo-600" aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block text-xs font-black text-slate-900">คัดลอกเกณฑ์ไปห้องอื่น</span>
                          <span className="block text-[11px] font-medium text-slate-500">ใช้ชุดคะแนนเดียวกันในหลายห้อง</span>
                        </span>
                      </button>

                      {(scoreView === 'excel' && contextAssessments.length > 0) ||
                      (scoreView === 'entry' && selectedAssessment) ? (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setIsToolsMenuOpen(false);
                            if (scoreView === 'excel') exportGridCsv();
                            else exportAssessmentCsv();
                          }}
                          className="flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left transition hover:bg-slate-50"
                        >
                          <Download size={15} className="mt-0.5 shrink-0 text-slate-600" aria-hidden="true" />
                          <span className="min-w-0">
                            <span className="block text-xs font-black text-slate-900">ดาวน์โหลดไฟล์ Excel / CSV</span>
                            <span className="block text-[11px] font-medium text-slate-500">
                              {scoreView === 'excel' ? 'ส่งออกตารางคะแนนรวมทั้งห้อง' : 'ส่งออกคะแนนช่องนี้'}
                            </span>
                          </span>
                        </button>
                      ) : null}

                      <div className="my-1.5 border-t border-slate-100" />

                      <Link
                        role="menuitem"
                        to="/app/dashboard?view=desirable-characteristics"
                        onClick={() => setIsToolsMenuOpen(false)}
                        className="flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left transition hover:bg-slate-50"
                      >
                        <GraduationCap size={15} className="mt-0.5 shrink-0 text-indigo-600" aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block text-xs font-black text-slate-900">ประเมินคุณลักษณะ 8 ประการ</span>
                          <span className="block text-[11px] font-medium text-slate-500">คุณลักษณะฯ และอ่าน คิดวิเคราะห์ เขียน</span>
                        </span>
                      </Link>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setIsToolsMenuOpen(false);
                          setIsGuideOpen(true);
                        }}
                        className="flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left transition hover:bg-slate-50"
                      >
                        <BookOpen size={15} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block text-xs font-black text-slate-900">คู่มือการใช้งานระบบคะแนน</span>
                          <span className="block text-[11px] font-medium text-slate-500">ดูวิธีใช้งานตารางคะแนนและการตัดเกรด</span>
                        </span>
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Bar 2: Streamlined 3-Step Workspace Tabs + Entry Mode Sub-Toggle */}
            <div className="mt-2 flex flex-col gap-2 border-t border-slate-100 pt-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-0.5">
                <button
                  className={`inline-flex h-7 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-black transition ${
                    scoreView === 'excel' || scoreView === 'entry'
                      ? 'bg-slate-950 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
                  }`}
                  onClick={() => handleScoreViewChange(getDefaultEntryScoreView())}
                  type="button"
                >
                  <Table
                    size={13}
                    className={scoreView === 'excel' || scoreView === 'entry' ? 'text-cyan-400' : 'text-slate-400'}
                    aria-hidden="true"
                  />
                  1. กรอกคะแนน
                </button>

                <button
                  className={`inline-flex h-7 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-black transition ${
                    scoreView === 'gradebook'
                      ? 'bg-slate-950 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
                  }`}
                  onClick={() => handleScoreViewChange('gradebook')}
                  type="button"
                >
                  <FileSpreadsheet
                    size={13}
                    className={scoreView === 'gradebook' ? 'text-cyan-400' : 'text-slate-400'}
                    aria-hidden="true"
                  />
                  2. สรุปเกรด (0–4)
                </button>

                {classrooms.length > 1 ? (
                  <button
                    className={`inline-flex h-7 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-black transition ${
                      scoreView === 'overview'
                        ? 'bg-slate-950 text-white shadow-2xs'
                        : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
                    }`}
                    onClick={() => handleScoreViewChange('overview')}
                    type="button"
                  >
                    <BarChart3
                      size={13}
                      className={scoreView === 'overview' ? 'text-cyan-400' : 'text-slate-400'}
                      aria-hidden="true"
                    />
                    3. เปรียบเทียบห้อง ({classroomsWithSubject.length})
                  </button>
                ) : null}
              </div>

              {/* Entry Mode Segmented Switch + Single-Assessment Picker */}
              {scoreView === 'excel' || scoreView === 'entry' ? (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center rounded-xl bg-slate-100 p-0.5">
                    <button
                      type="button"
                      onClick={() => handleScoreViewChange('excel')}
                      className={`inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-black transition ${
                        scoreView === 'excel'
                          ? 'bg-white text-slate-950 shadow-2xs ring-1 ring-slate-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Table size={12} aria-hidden="true" />
                      ตารางรวม
                    </button>
                    <button
                      type="button"
                      onClick={() => handleScoreViewChange('entry')}
                      className={`inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-black transition ${
                        scoreView === 'entry'
                          ? 'bg-white text-slate-950 shadow-2xs ring-1 ring-slate-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <ClipboardList size={12} aria-hidden="true" />
                      ทีละช่อง
                    </button>
                  </div>

                  {scoreView === 'entry' && contextAssessments.length > 0 ? (
                    <div className="flex items-center gap-1.5">
                      <span className="shrink-0 text-[11px] font-black text-slate-500">ชิ้นงาน:</span>
                      <select
                        className="h-8 max-w-[220px] truncate rounded-xl border border-cyan-200 bg-cyan-50/60 px-2.5 text-xs font-black text-cyan-900 outline-none transition focus:border-cyan-400 focus:bg-white"
                        onChange={(event) => {
                          const nextId = event.target.value;
                          if (nextId !== selectedAssessment?.id && !confirmDiscardUnsavedChanges()) return;
                          setSelectedAssessmentId(nextId);
                        }}
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
              ) : null}
            </div>
          </section>

          {/* Notice Banner */}
          {notice ? (
            <div className="mt-2.5 flex items-center justify-between gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-xs font-black text-cyan-900 shadow-sm animate-fade-in">
              <div className="flex items-center gap-2">
                <AlertTriangle className="shrink-0 text-cyan-700" size={16} aria-hidden="true" />
                <p>{notice}</p>
              </div>
              <button
                className="text-xs text-cyan-700 underline hover:text-cyan-950"
                onClick={() => setNotice(null)}
                type="button"
              >
                ปิด
              </button>
            </div>
          ) : null}
        </>
      )}

      {/* 3A: MODERN GRADEBOOK SHEET (All assessments in one compact OBEC spreadsheet) */}
      {scoreView === 'excel' ? (
        <div className="mt-3">
          <ModernGradebookSheet
            assessments={contextAssessments}
            classroomName={activeClassroom?.name}
            entriesByAssessment={entriesByAssessment}
            formatScore={formatScore}
            getScoreBand={getScoreBand}
            getThaiGrade={getThaiGrade}
            gridScores={gridScores}
            isStickyRoster={isStickyRoster}
            onAddAssessment={() => openCreateAssessmentModal()}
            onChangeGridScores={setGridScores}
            onDeleteAssessment={(assessment) => void handleDeleteAssessment(assessment)}
            onEditAssessment={openEditModal}
            onNotice={(message) => setNotice(message)}
            onOpenAssessmentEntry={(assessmentId) => {
              setSelectedAssessmentId(assessmentId);
              handleScoreViewChange('entry');
            }}
            onOpenAssessmentOcr={(assessmentId) => {
              setSelectedAssessmentId(assessmentId);
              setIsScoreOcrOpen(true);
            }}
            onOpenRatioModal={() => setIsRatioModalOpen(true)}
            onSearchTermChange={setSearchTerm}
            onToggleStickyRoster={() => setIsStickyRoster((prev) => !prev)}
            plannedTotalWeight={plannedTotalWeight}
            scoreBandSummaries={scoreBandSummaries}
            searchTerm={searchTerm}
            studentSeatNumberMap={studentSeatNumberMap}
            students={filteredStudents}
            totalStudentsCount={classroomStudents.length}
          />
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
                        {getAssessmentCategoryLabel(selectedAssessment)}
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
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-[#1C342B] px-3.5 text-xs font-black text-white shadow-sm hover:bg-[#2F7D5B] active:scale-[0.98] transition-all"
                      onClick={() => setIsScoreOcrOpen(true)}
                      title="ถ่ายภาพหรืออัปโหลดรูปใบคะแนนเพื่อถอดรหัสคะแนนด้วย AI Vision"
                      type="button"
                    >
                      <Camera size={14} className="text-emerald-200" aria-hidden="true" />
                      <span>สแกนใบคะแนน AI Vision</span>
                      <span className="rounded bg-white/15 px-1 py-0.2 text-[9px] font-black uppercase tracking-wider border border-white/20">AI</span>
                    </button>
                    <button
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-cyan-300 bg-cyan-50 px-3 text-xs font-black text-cyan-800 hover:bg-cyan-100 transition shadow-2xs"
                      disabled={isSubmitting}
                      onClick={() => openEditModal(selectedAssessment)}
                      type="button"
                    >
                      <Edit3 size={14} aria-hidden="true" />
                      แก้ไขชุดคะแนน / ปรับน้ำหนัก
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
                    <span className="hidden items-center gap-1.5 text-xs font-bold text-[#5A6F64] xl:inline-flex">
                      <Lightbulb size={13} className="text-[#D98B26] shrink-0" aria-hidden="true" />
                      เคล็ดลับ: กด Enter หรือ ลูกศรลง เพื่อเลื่อนไปคนถัดไป | วางจาก Excel ได้โดยตรง
                    </span>
                  </div>
                </div>

                {/* Mobile Card List (< md) — thumb-friendly Speed Grader with zero horizontal scrolling */}
                <div className="mt-4 space-y-2.5 md:hidden">
                  {filteredStudents.map((student, idx) => {
                    const entry = selectedEntryByStudent.get(student.id);
                    const scoreValue =
                      scores[student.id] ??
                      (entry?.score === null || entry?.score === undefined ? '' : String(entry.score));
                    const scoreNumber = scoreValue === '' ? null : Number(scoreValue);
                    const percent =
                      scoreNumber !== null && Number.isFinite(scoreNumber)
                        ? Math.round((scoreNumber / selectedAssessment.max_score) * 10000) / 100
                        : null;
                    const gradeInfo = getThaiGrade(percent);
                    const seatNumber = studentSeatNumberMap.get(student.id) ?? idx + 1;
                    const quickPresets = buildQuickScorePresets(selectedAssessment.max_score);

                    return (
                      <div
                        key={student.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold text-slate-400">
                              <span className="font-mono font-black text-slate-600">เลขที่ {seatNumber}</span>
                              {student.student_code ? (
                                <span className="ml-2 font-mono">รหัส {student.student_code}</span>
                              ) : null}
                            </p>
                            <p className="truncate text-sm font-black text-slate-900">
                              {student.first_name} {student.last_name}
                              {student.nickname ? (
                                <span className="ml-1.5 text-xs font-bold text-slate-400">
                                  ({student.nickname})
                                </span>
                              ) : null}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-black ring-1 ${
                                percent === null
                                  ? 'bg-white text-slate-400 ring-slate-200'
                                  : percent < 50
                                    ? 'bg-rose-50 text-rose-700 ring-rose-200'
                                    : percent < 70
                                      ? 'bg-amber-50 text-amber-700 ring-amber-200'
                                      : 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                              }`}
                            >
                              {percent === null ? '-' : `${percent}%`}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ring-1 ${gradeInfo.badgeClass}`}>
                              {percent === null ? 'รอคะแนน' : `เกรด ${gradeInfo.grade}`}
                            </span>
                            <button
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                              onClick={() => void handleClearStudentScore(student)}
                              title="ล้างคะแนนคนนี้"
                              type="button"
                            >
                              <Trash2 size={14} aria-hidden="true" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-2">
                          <label className="text-xs font-bold text-slate-500 shrink-0">
                            คะแนน (เต็ม {selectedAssessment.max_score})
                          </label>
                          <input
                            className="h-11 w-24 rounded-xl border border-slate-300 bg-white px-3 text-center text-base font-black text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                            inputMode="decimal"
                            max={selectedAssessment.max_score}
                            min="0"
                            onChange={(event) =>
                              setScores((current) => ({ ...current, [student.id]: event.target.value }))
                            }
                            placeholder="-"
                            step="any"
                            type="number"
                            value={scoreValue}
                          />
                        </div>

                        {/* Tap-friendly Quick-Score Presets */}
                        {quickPresets.length > 0 ? (
                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-black text-slate-400">แตะเลือกด่วน:</span>
                            {quickPresets.map((preset) => {
                              const isActive = scoreValue === String(preset);
                              const isFull = preset === selectedAssessment.max_score;
                              return (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() =>
                                    setScores((current) => ({ ...current, [student.id]: String(preset) }))
                                  }
                                  className={`h-8 rounded-xl border px-2.5 font-mono text-xs font-black active:scale-95 transition ${
                                    isActive
                                      ? 'border-cyan-600 bg-cyan-600 text-white shadow-2xs'
                                      : isFull
                                        ? 'border-cyan-200 bg-cyan-50 text-cyan-900 hover:bg-cyan-100'
                                        : 'border-slate-200 bg-white text-slate-700 hover:border-cyan-300 hover:bg-cyan-50/40'
                                  }`}
                                >
                                  {isFull ? `เต็ม ${formatScore(preset)}` : formatScore(preset)}
                                </button>
                              );
                            })}
                            <button
                              type="button"
                              onClick={() =>
                                setScores((current) => ({ ...current, [student.id]: '0' }))
                              }
                              className={`h-8 rounded-xl border px-2.5 font-mono text-xs font-black active:scale-95 transition ${
                                scoreValue === '0'
                                  ? 'border-rose-500 bg-rose-600 text-white'
                                  : 'border-slate-200 bg-white text-slate-500 hover:bg-rose-50 hover:text-rose-700'
                              }`}
                            >
                              0
                            </button>
                          </div>
                        ) : null}

                        <input
                          className="mt-2.5 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none focus:border-cyan-400"
                          onChange={(event) =>
                            setNotes((current) => ({ ...current, [student.id]: event.target.value }))
                          }
                          placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)..."
                          value={notes[student.id] ?? entry?.note ?? ''}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Score Table (md+) */}
                <div className="mt-4 hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[760px] divide-y divide-slate-100 text-left">
                    <thead>
                      <tr className="bg-slate-50/80 text-[11px] font-black uppercase text-slate-500">
                        <th className="w-14 px-3 py-2.5 text-center">เลขที่</th>
                        <th className="px-3 py-2.5">ชื่อ-นามสกุล</th>
                        <th className="px-3 py-2.5 min-w-[230px]">
                          คะแนน (เต็ม {selectedAssessment.max_score})
                        </th>
                        <th className="px-3 py-2.5">ร้อยละ</th>
                        <th className="px-3 py-2.5">เกรดประเมิน</th>
                        <th className="px-3 py-2.5">หมายเหตุ</th>
                        <th className="px-3 py-2.5 text-right">ล้าง</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                      {filteredStudents.map((student, idx) => {
                        const entry = selectedEntryByStudent.get(student.id);
                        const scoreValue = scores[student.id] ?? (entry?.score === null || entry?.score === undefined ? '' : String(entry.score));
                        const scoreNumber = scoreValue === '' ? null : Number(scoreValue);
                        const percent =
                          scoreNumber !== null && Number.isFinite(scoreNumber)
                            ? Math.round((scoreNumber / selectedAssessment.max_score) * 10000) / 100
                            : null;
                        const gradeInfo = getThaiGrade(percent);
                        const seatNumber = studentSeatNumberMap.get(student.id) ?? idx + 1;
                        const quickPresets = buildQuickScorePresets(selectedAssessment.max_score);

                        return (
                          <tr className="hover:bg-slate-50/80 transition" key={student.id}>
                            <td className="whitespace-nowrap px-3 py-2.5 text-center font-mono font-black text-slate-500">
                              {seatNumber}
                            </td>
                            <td className="px-3 py-2.5">
                              <p className="font-black text-slate-900">
                                {student.first_name} {student.last_name}
                              </p>
                              {student.student_code || student.nickname ? (
                                <p className="text-[11px] font-semibold text-slate-400">
                                  {student.student_code ? <span className="font-mono">#{student.student_code}</span> : null}
                                  {student.student_code && student.nickname ? ' · ' : null}
                                  {student.nickname ? `(${student.nickname})` : null}
                                </p>
                              ) : null}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5">
                              <div className="flex items-center gap-1.5">
                                <input
                                  className="h-9 w-20 rounded-xl border border-slate-200 bg-white px-2.5 text-center font-mono text-sm font-black text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
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
                                {quickPresets.map((preset) => {
                                  const isFull = preset === selectedAssessment.max_score;
                                  const isActive = scoreValue === String(preset);
                                  return (
                                    <button
                                      key={preset}
                                      className={`rounded-lg border px-2 py-1.5 text-[10px] font-black transition ${
                                        isActive
                                          ? 'border-cyan-600 bg-cyan-600 text-white'
                                          : isFull
                                            ? 'border-cyan-200 bg-cyan-50 text-cyan-800 hover:bg-cyan-100'
                                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-800'
                                      }`}
                                      onClick={() =>
                                        setScores((current) => ({ ...current, [student.id]: String(preset) }))
                                      }
                                      title={isFull ? 'ให้คะแนนเต็มสำหรับคนนี้' : `ใส่ ${formatScore(preset)} คะแนน`}
                                      type="button"
                                    >
                                      {isFull ? 'เต็ม' : formatScore(preset)}
                                    </button>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5">
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
                            <td className="whitespace-nowrap px-3 py-2.5">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black ring-1 ${gradeInfo.badgeClass}`}
                                title={gradeInfo.label}
                              >
                                {percent === null ? 'รอคะแนน' : `เกรด ${gradeInfo.grade}`}
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
                onClick={() => openCreateAssessmentModal()}
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

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                {/* Configure Ratio Button */}
                <button
                  type="button"
                  onClick={() => setIsRatioModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-cyan-300 bg-cyan-50 px-3.5 py-2 text-xs font-black text-cyan-900 hover:bg-cyan-100 hover:border-cyan-400 transition shadow-2xs"
                  title="ปรับสัดส่วนเกณฑ์คะแนน (ระหว่างเรียน : กลางภาค : ปลายภาค)"
                >
                  <Settings2 size={15} className="text-cyan-700" aria-hidden="true" />
                  <div className="text-left">
                    <p className="text-[10px] text-cyan-600 font-bold leading-none">เกณฑ์สัดส่วนคะแนนวิชานี้</p>
                    <p className="mt-0.5 text-xs font-black text-[#1C342B]">
                      {scoreRatio.coursework} : {scoreRatio.midterm} : {scoreRatio.final}
                    </p>
                  </div>
                </button>

                {/* Planned Weight Progress Meter */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 min-w-[220px]">
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
                  <p className="mt-1.5 inline-flex items-center justify-end gap-1 w-full text-[10px] font-bold text-[#5A6F64] text-right">
                    {plannedTotalWeight === 100 ? (
                      <>
                        <Check size={11} className="text-[#2F7D5B]" aria-hidden="true" />
                        โครงสร้างคะแนนครบ 100 พอดี
                      </>
                    ) : plannedTotalWeight < 100 ? (
                      `ขาดอีก ${100 - plannedTotalWeight} คะแนนให้ครบ 100`
                    ) : (
                      `เกินไป ${plannedTotalWeight - 100} คะแนน`
                    )}
                  </p>
                </div>
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

          {/* Remedial / Incomplete Tracking Queue (ร / 0) */}
          {contextAssessments.length > 0 && remedialQueueRows.length > 0 && (
            <div className="rounded-3xl border border-amber-200 bg-gradient-to-r from-amber-50/90 via-rose-50/40 to-white p-4 sm:p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={18} className="text-amber-600 shrink-0" />
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-slate-900">
                      คิวติดตามงานค้าง / ซ่อมเสริม (เกณฑ์ ร / 0)
                    </h3>
                    <p className="text-xs font-semibold text-slate-600">
                      พบนักเรียนที่ยังมีช่องคะแนนว่างหรือคะแนนรวมต่ำกว่า 50% จำนวน {remedialQueueRows.length} คน — กดชื่อชิ้นงานเพื่อเข้าไปกรอกทันที
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {incompleteRCount > 0 && (
                    <span className="rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-xs font-black text-amber-900">
                      งานค้าง / เสี่ยง ร: {incompleteRCount} คน
                    </span>
                  )}
                  {fail0Count > 0 && (
                    <span className="rounded-full border border-rose-300 bg-rose-100 px-2.5 py-0.5 text-xs font-black text-rose-900">
                      ไม่ผ่าน (&lt;50%) / เกรด 0: {fail0Count} คน
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-3 grid max-h-56 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                {remedialQueueRows.map((row) => (
                  <div
                    key={row.student.id}
                    className={`rounded-2xl border p-3 text-xs ${
                      row.academicStatus === 'fail_0'
                        ? 'border-rose-200 bg-white'
                        : 'border-amber-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-black text-slate-900 truncate">
                        {row.student.student_code ? `${row.student.student_code} ` : ''}
                        {row.student.first_name} {row.student.last_name}
                      </p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${
                          row.academicStatus === 'fail_0'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {row.academicStatus === 'fail_0'
                          ? `เกรด 0 (${row.finalPercent.toFixed(0)}%)`
                          : `ขาด ${row.missingAssessments.length} ชิ้น`}
                      </span>
                    </div>
                    {row.missingAssessments.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {row.missingAssessments.slice(0, 3).map((assessment) => (
                          <button
                            key={assessment.id}
                            type="button"
                            onClick={() => {
                              setSelectedAssessmentId(assessment.id);
                              handleScoreViewChange('entry');
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-900 hover:bg-amber-100 transition"
                            title="คลิกเพื่อเปิดหน้ากรอกคะแนนชิ้นงานนี้"
                          >
                            <span>{assessment.title}</span>
                            <ArrowRight size={10} />
                          </button>
                        ))}
                        {row.missingAssessments.length > 3 && (
                          <span className="text-[10px] font-bold text-slate-500 self-center">
                            +{row.missingAssessments.length - 3} ชิ้น
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="mt-1.5 text-[11px] font-semibold text-rose-700">
                        กรอกคะแนนครบแล้ว — แนะนำจัดสอบ/งานซ่อมเสริมให้ถึง 50%
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Master Table + Mobile Card List */}
          <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
            {/* Mobile Card List (< md) — thumb-friendly, zero horizontal scrolling */}
            <div className="space-y-2.5 md:hidden">
              {studentGradebookRows.map((row) => {
                const gradeInfo = getThaiGrade(row.hasAnyScore ? row.finalPercent : null);
                const missingCount = missingCountByStudent.get(row.student.id) || 0;

                return (
                  <div
                    key={row.student.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-[11px] font-bold text-slate-400">
                          รหัส {row.student.student_code || '-'}
                        </p>
                        <p className="truncate text-sm font-black text-slate-900">
                          {row.student.first_name} {row.student.last_name}
                          {row.student.nickname ? (
                            <span className="ml-1.5 text-xs font-bold text-slate-400">
                              ({row.student.nickname})
                            </span>
                          ) : null}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-black ring-1 ${gradeInfo.badgeClass}`}
                        >
                          {row.hasAnyScore ? `เกรด ${gradeInfo.grade}` : 'รอคะแนน'}
                        </span>
                        {missingCount > 0 ? (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                            ค้าง {missingCount} ช่อง
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
                      {scoreBandConfigs.map((band) => {
                        const score = row.bandScores[band.key];
                        return (
                          <div key={band.key} className="rounded-xl border border-slate-200/70 bg-white px-2 py-1.5">
                            <p className="truncate text-[10px] font-bold text-slate-500">{band.label}</p>
                            <p className="mt-0.5 font-mono text-xs font-black text-slate-900">
                              {formatScore(score.earnedWeight)}
                              <span className="font-normal text-slate-400">/{formatScore(score.plannedWeight)}</span>
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-2.5 flex items-center justify-between border-t border-slate-200/70 pt-2 text-xs font-bold">
                      <span className="text-slate-600">
                        รวม:{' '}
                        <strong className="font-mono text-slate-900">
                          {formatScore(row.earnedTotal)}
                        </strong>{' '}
                        <span className="font-normal text-slate-400">/ {formatScore(row.plannedWeight)}</span>
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-black ring-1 ${
                          !row.hasAnyScore
                            ? 'bg-slate-100 text-slate-500 ring-slate-200'
                            : row.completionPercent < 100
                              ? 'bg-amber-50 text-amber-700 ring-amber-200'
                              : row.finalPercent < 50
                                ? 'bg-rose-50 text-rose-700 ring-rose-200'
                                : 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                        }`}
                      >
                        {row.hasAnyScore ? `${row.finalPercent.toFixed(1)}%` : '-'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Master Table (md+) */}
            <div className="hidden overflow-x-auto md:block">
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
                    const gradeInfo = getThaiGrade(row.hasAnyScore ? row.finalPercent : null);

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
                              !row.hasAnyScore
                                ? 'bg-slate-100 text-slate-500 ring-slate-200'
                                : row.completionPercent < 100
                                  ? 'bg-amber-50 text-amber-700 ring-amber-200'
                                  : row.finalPercent < 50
                                    ? 'bg-rose-50 text-rose-700 ring-rose-200'
                                    : 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                            }`}
                          >
                            {row.hasAnyScore ? `${row.finalPercent.toFixed(1)}%` : '-'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-center">
                          <div className="inline-flex flex-col items-center gap-1">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ring-1 ${gradeInfo.badgeClass}`}
                            >
                              {row.hasAnyScore ? `เกรด ${gradeInfo.grade} (${gradeInfo.label})` : 'รอคะแนน'}
                            </span>
                            {(missingCountByStudent.get(row.student.id) || 0) > 0 && (
                              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                                ค้าง {missingCountByStudent.get(row.student.id)} ช่อง (รอ ร)
                              </span>
                            )}
                          </div>
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

      {/* 3D: OVERVIEW / COMPARISON VIEW */}
      {scoreView === 'overview' ? (
        perspective === 'subject' ? (
          /* Cross-Classroom Comparison View for Subject Mode */
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

              {/* Mobile Card List View (md:hidden) */}
              <div className="mt-4 flex flex-col gap-3 md:hidden">
                {crossClassroomStats.map((row) => (
                  <div key={row.classroom.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-700 text-xs font-black">
                          {row.classroom.name.slice(0, 4)}
                        </span>
                        <div className="min-w-0">
                          <p className="font-black text-slate-900 text-sm truncate">{row.classroom.name}</p>
                          <p className="text-[11px] text-slate-400 font-medium">ปี {row.classroom.academic_year || '2569'} • {row.studentCount} คน • {row.assessmentCount} ชุด</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setClassroomId(row.classroom.id);
                          handleScoreViewChange('excel');
                        }}
                        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#2F7D5B] px-3 py-2 text-xs font-black text-white hover:bg-[#1C342B] transition shadow-xs"
                      >
                        <Edit3 size={13} aria-hidden="true" />
                        เข้ากรอก
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
                      <div className="rounded-xl bg-slate-50 p-2">
                        <p className="text-[10px] text-slate-500 font-bold">ส่งงานครบ</p>
                        <span className={`inline-block mt-0.5 text-xs font-black ${row.completionPercent >= 80 ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {row.completionPercent}%
                        </span>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-2">
                        <p className="text-[10px] text-slate-500 font-bold">เฉลี่ย / เกรด</p>
                        <p className="mt-0.5 text-xs font-black text-slate-900">
                          {row.averagePercent.toFixed(1)}% <span className="text-[10px] text-slate-500 font-bold">({getThaiGrade(row.averagePercent).grade})</span>
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-2">
                        <p className="text-[10px] text-slate-500 font-bold">ผ่านเกณฑ์</p>
                        <p className="mt-0.5 text-xs font-black text-slate-900">
                          {row.passingRate}% <span className="text-[10px] text-slate-400 font-normal">({row.passingCount}/{row.studentCount})</span>
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-[10px] text-slate-500 font-bold mb-1.5">การกระจายเกรด (4 / 3 / 2 / 1 / 0):</p>
                      <div className="grid grid-cols-5 gap-1 text-center font-mono text-[11px]">
                        <div className="rounded-lg bg-emerald-50 py-1 text-emerald-800 font-bold border border-emerald-100" title="เกรด 4">
                          4: {row.gradeCounts.g4}
                        </div>
                        <div className="rounded-lg bg-teal-50 py-1 text-teal-800 font-bold border border-teal-100" title="เกรด 3 หรือ 3.5">
                          3: {row.gradeCounts.g3}
                        </div>
                        <div className="rounded-lg bg-blue-50 py-1 text-blue-800 font-bold border border-blue-100" title="เกรด 2 หรือ 2.5">
                          2: {row.gradeCounts.g2}
                        </div>
                        <div className="rounded-lg bg-amber-50 py-1 text-amber-800 font-bold border border-amber-100" title="เกรด 1 หรือ 1.5">
                          1: {row.gradeCounts.g1}
                        </div>
                        <div className="rounded-lg bg-rose-50 py-1 text-rose-800 font-bold border border-rose-100" title="เกรด 0">
                          0: {row.gradeCounts.g0}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop/Tablet Table View (hidden md:block) */}
              <div className="mt-4 hidden md:block overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full min-w-[840px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-black">
                      <th className="px-4 py-3 border-b border-slate-200 whitespace-nowrap">ห้องเรียน</th>
                      <th className="px-3 py-3 border-b border-slate-200 text-center whitespace-nowrap">นักเรียน</th>
                      <th className="px-3 py-3 border-b border-slate-200 text-center whitespace-nowrap">ชุดคะแนน</th>
                      <th className="px-3 py-3 border-b border-slate-200 text-center whitespace-nowrap">ส่งงานครบ (%)</th>
                      <th className="px-3 py-3 border-b border-slate-200 text-center whitespace-nowrap">คะแนนเฉลี่ย (%)</th>
                      <th className="px-3 py-3 border-b border-slate-200 text-center whitespace-nowrap">ผ่านเกณฑ์</th>
                      <th className="px-4 py-3 border-b border-slate-200 min-w-[180px] whitespace-nowrap">การกระจายเกรด (4 / 3 / 2 / 1 / 0)</th>
                      <th className="px-4 py-3 border-b border-slate-200 text-right whitespace-nowrap">การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {crossClassroomStats.map((row) => (
                      <tr key={row.classroom.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3.5 font-black text-slate-900 whitespace-nowrap">
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
                        <td className="px-3 py-3.5 text-center font-bold text-slate-700 whitespace-nowrap">{row.studentCount} คน</td>
                        <td className="px-3 py-3.5 text-center font-bold text-slate-700 whitespace-nowrap">{row.assessmentCount} ชุด</td>
                        <td className="px-3 py-3.5 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-black ${
                              row.completionPercent >= 80 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {row.completionPercent}%
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-center whitespace-nowrap">
                          <div className="flex flex-col items-center">
                            <span className="font-black text-slate-900 text-sm">{row.averagePercent.toFixed(1)}%</span>
                            <span className="text-[10px] font-bold text-slate-400">
                              เกรด {getThaiGrade(row.averagePercent).grade}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3.5 text-center whitespace-nowrap">
                          <span className="font-black text-slate-800">{row.passingRate}%</span>
                          <span className="text-[10px] text-slate-400 block">
                            ({row.passingCount}/{row.studentCount})
                          </span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
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
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <button
                            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl bg-[#E9F0EA] px-3 text-xs font-black text-[#1C342B] hover:bg-[#DCE3D7] transition border border-[#DCE3D7] whitespace-nowrap"
                            onClick={() => {
                              setClassroomId(row.classroom.id);
                              handleScoreViewChange('excel');
                            }}
                            type="button"
                          >
                            <Edit3 size={12} aria-hidden="true" />
                            เข้ากรอกคะแนน
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
          /* Classroom Teaching Matrix for Classroom Mode */
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
                    handleScoreViewChange('excel');
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
        )
      ) : null}

      {/* 4. Sticky Floating Save Bar (Triggered when there are unsaved edits in Entry or Excel Grid) */}
      {scoreView === 'excel' && unsavedGridCount > 0 ? (
        <div className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] lg:bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl bg-slate-950 px-4 sm:px-5 py-2.5 sm:py-3 text-white shadow-2xl animate-fade-in ring-1 ring-white/15 max-w-[94vw] sm:max-w-none flex-wrap sm:flex-nowrap justify-between">
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
                  const ok = await handleSaveGridScores();
                  if (ok) setClassroomId(nextClassroom.id);
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
        <div className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] lg:bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl bg-slate-950 px-4 sm:px-5 py-2.5 sm:py-3 text-white shadow-2xl animate-fade-in ring-1 ring-white/15 max-w-[94vw] sm:max-w-none flex-wrap sm:flex-nowrap justify-between">
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
                  const ok = await handleSaveScores();
                  if (ok) setClassroomId(nextClassroom.id);
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-xs"
          role="dialog"
        >
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl animate-scale-up">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 pb-4 pt-5">
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

            {/* Scrollable Form Body + Fixed Footer */}
            <form
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={(event) => void handleCreateAssessment(event)}
            >
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-4">
                {/* 1-Click Quick Presets (Single Unified Bar) */}
                <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-3">
                  <span className="mb-2 flex items-center gap-1.5 text-[11px] font-black text-sky-950">
                    <Sparkles size={14} className="text-sky-600" aria-hidden="true" />
                    เลือกแม่แบบชุดคะแนนด่วน (คลิกเดียวกรอกครบ):
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    <button
                      type="button"
                      onClick={() => {
                        setForm((c) => ({
                          ...c,
                          title: 'แบบฝึกหัด/ใบงานย่อย',
                          category: 'assignment',
                          maxScore: '10',
                          weight: '10',
                        }));
                      }}
                      className="rounded-xl border border-sky-200 bg-white p-2 text-left text-xs font-bold text-slate-700 transition hover:border-sky-400 hover:bg-sky-50/50"
                    >
                      <p className="inline-flex items-center gap-1 font-black text-[#1C342B]">
                        <ClipboardList size={13} className="text-[#2F7D5B]" aria-hidden="true" /> ใบงาน
                      </p>
                      <p className="text-[10px] text-[#5A6F64]">เต็ม 10 · น้ำหนัก 10</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setForm((c) => ({
                          ...c,
                          title: 'แบบทดสอบย่อยท้ายบท',
                          category: 'quiz',
                          maxScore: '20',
                          weight: '10',
                        }));
                      }}
                      className="rounded-xl border border-[#DCE3D7] bg-white p-2 text-left text-xs font-bold text-slate-700 transition hover:border-[#2F7D5B] hover:bg-[#E9F0EA]/40"
                    >
                      <p className="inline-flex items-center gap-1 font-black text-[#1C342B]">
                        <BarChart3 size={13} className="text-[#2D72A3]" aria-hidden="true" /> สอบย่อย
                      </p>
                      <p className="text-[10px] text-[#5A6F64]">เต็ม 20 · น้ำหนัก 10</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const midtermWeight = String(scoreRatio.midterm || 20);
                        setForm((c) => ({
                          ...c,
                          title: 'สอบวัดผลกลางภาค',
                          category: 'midterm',
                          maxScore: midtermWeight,
                          weight: midtermWeight,
                        }));
                      }}
                      className="rounded-xl border border-[#DCE3D7] bg-white p-2 text-left text-xs font-bold text-slate-700 transition hover:border-[#2F7D5B] hover:bg-[#E9F0EA]/40"
                    >
                      <p className="inline-flex items-center gap-1 font-black text-[#1C342B]">
                        <Target size={13} className="text-[#D98B26]" aria-hidden="true" /> กลางภาค
                      </p>
                      <p className="text-[10px] text-[#5A6F64]">
                        เต็ม {scoreRatio.midterm || 20} · {scoreRatio.midterm || 20}%
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const finalWeight = String(scoreRatio.final || 30);
                        setForm((c) => ({
                          ...c,
                          title: 'สอบวัดผลปลายภาค',
                          category: 'final',
                          maxScore: finalWeight,
                          weight: finalWeight,
                        }));
                      }}
                      className="rounded-xl border border-[#DCE3D7] bg-white p-2 text-left text-xs font-bold text-slate-700 transition hover:border-[#2F7D5B] hover:bg-[#E9F0EA]/40"
                    >
                      <p className="inline-flex items-center gap-1 font-black text-[#1C342B]">
                        <Award size={13} className="text-[#C25970]" aria-hidden="true" /> ปลายภาค
                      </p>
                      <p className="text-[10px] text-[#5A6F64]">
                        เต็ม {scoreRatio.final || 30} · {scoreRatio.final || 30}%
                      </p>
                    </button>
                  </div>
                </div>

                {/* Target Classrooms Selection */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-black text-slate-700">
                      <Users size={14} className="text-indigo-600" aria-hidden="true" />
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

                  <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {classrooms.map((c) => {
                      const isChecked =
                        form.targetClassroomIds.length === 0
                          ? c.id === classroomId
                          : form.targetClassroomIds.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className={`flex cursor-pointer items-center gap-2 rounded-xl border p-2 text-xs font-bold transition ${
                            isChecked
                              ? 'border-indigo-300 bg-indigo-50 font-black text-indigo-950 ring-1 ring-indigo-200'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
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
                      className="nexus-field mt-1.5 h-10 w-full px-3 text-xs font-bold"
                      list="score-subject-options-modal"
                      onChange={(event) => {
                        setForm((current) => ({ ...current, subjectName: event.target.value }));
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

                <div className="flex items-center justify-between gap-2 rounded-xl border border-[#DCE3D7] bg-[#FAFBF8] p-2.5 text-[11px] font-bold text-[#5A6F64]">
                  <span className="inline-flex items-center gap-1.5">
                    <Lightbulb size={13} className="shrink-0 text-[#D98B26]" aria-hidden="true" />
                    ทิป: ถ้าทำได้ 10 ข้อ คิด 10 คะแนน ให้ใส่ตัวเลขเท่ากัน
                  </span>
                  <button
                    type="button"
                    onClick={() => setForm((c) => ({ ...c, weight: c.maxScore }))}
                    className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-black text-cyan-800 hover:bg-slate-100"
                  >
                    กดให้เท่ากัน (1:1)
                  </button>
                </div>
              </div>

              <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-6 py-4">
                <button
                  className="h-10 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 transition hover:bg-slate-50"
                  onClick={() => setIsCreateModalOpen(false)}
                  type="button"
                >
                  ยกเลิก
                </button>
                <button
                  className="h-10 rounded-2xl bg-cyan-600 px-5 text-xs font-black text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-50"
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

      {/* Score Ratio Customization Modal Dialog */}
      {isRatioModalOpen ? (
        <div
          aria-labelledby="modal-ratio-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-fade-in"
          role="dialog"
        >
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-50 text-cyan-600">
                  <Settings2 size={20} aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900" id="modal-ratio-title">
                    ปรับสัดส่วนเกณฑ์คะแนนรวม (100 คะแนน)
                  </h3>
                  <p className="text-xs text-slate-500">
                    กำหนดสัดส่วนระหว่างเรียน กลางภาค และปลายภาค เพื่อใช้เป็นเกณฑ์ตัดเกรด
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRatioModalOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Presets */}
              <div>
                <p className="text-xs font-black text-slate-700 mb-2">เลือกเกณฑ์มาตรฐานยอดนิยม:</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setScoreRatio({ coursework: 50, midterm: 20, final: 30 });
                    }}
                    className={`rounded-xl border p-2.5 text-left transition ${
                      scoreRatio.coursework === 50 && scoreRatio.midterm === 20 && scoreRatio.final === 30
                        ? 'border-cyan-500 bg-cyan-50/70 ring-1 ring-cyan-400'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <p className="font-black text-xs text-slate-900">70 : 30 (สพฐ. มาตรฐาน)</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">ระหว่างเรียน 50 | กลาง 20 | ปลาย 30</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setScoreRatio({ coursework: 70, midterm: 0, final: 30 });
                    }}
                    className={`rounded-xl border p-2.5 text-left transition ${
                      scoreRatio.coursework === 70 && scoreRatio.midterm === 0 && scoreRatio.final === 30
                        ? 'border-cyan-500 bg-cyan-50/70 ring-1 ring-cyan-400'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <p className="font-black text-xs text-slate-900">70 : 30 (สอบปลายภาคเท่านั้น)</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">ระหว่างเรียน 70 | กลาง 0 | ปลาย 30</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setScoreRatio({ coursework: 60, midterm: 20, final: 20 });
                    }}
                    className={`rounded-xl border p-2.5 text-left transition ${
                      scoreRatio.coursework === 60 && scoreRatio.midterm === 20 && scoreRatio.final === 20
                        ? 'border-cyan-500 bg-cyan-50/70 ring-1 ring-cyan-400'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <p className="font-black text-xs text-slate-900">80 : 20 (เน้นปฏิบัติ/กิจกรรม)</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">ระหว่างเรียน 60 | กลาง 20 | ปลาย 20</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setScoreRatio({ coursework: 80, midterm: 0, final: 20 });
                    }}
                    className={`rounded-xl border p-2.5 text-left transition ${
                      scoreRatio.coursework === 80 && scoreRatio.midterm === 0 && scoreRatio.final === 20
                        ? 'border-cyan-500 bg-cyan-50/70 ring-1 ring-cyan-400'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <p className="font-black text-xs text-slate-900">80 : 20 (สอบปลายภาคเท่านั้น)</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">ระหว่างเรียน 80 | กลาง 0 | ปลาย 20</p>
                  </button>
                </div>
              </div>

              {/* Custom inputs */}
              <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                <p className="text-xs font-black text-slate-700 mb-3">ปรับตัวเลขสัดส่วนเอง (รวมต้องได้ 100):</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">ระหว่างเรียน</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={scoreRatio.coursework}
                      onChange={(e) =>
                        setScoreRatio((prev) => ({ ...prev, coursework: Number(e.target.value) || 0 }))
                      }
                      className="w-full h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-center font-black text-sm text-slate-900 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">กลางภาค</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={scoreRatio.midterm}
                      onChange={(e) =>
                        setScoreRatio((prev) => ({ ...prev, midterm: Number(e.target.value) || 0 }))
                      }
                      className="w-full h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-center font-black text-sm text-slate-900 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">ปลายภาค</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={scoreRatio.final}
                      onChange={(e) =>
                        setScoreRatio((prev) => ({ ...prev, final: Number(e.target.value) || 0 }))
                      }
                      className="w-full h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-center font-black text-sm text-slate-900 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-200 text-xs font-black">
                  <span>ผลรวมสัดส่วน:</span>
                  <span
                    className={
                      scoreRatio.coursework + scoreRatio.midterm + scoreRatio.final === 100
                        ? 'text-emerald-700'
                        : 'text-rose-600'
                    }
                  >
                    {scoreRatio.coursework + scoreRatio.midterm + scoreRatio.final} / 100 คะแนน
                    {scoreRatio.coursework + scoreRatio.midterm + scoreRatio.final !== 100 && ' (ต้องเท่ากับ 100 พอดี)'}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsRatioModalOpen(false)}
                className="h-10 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 hover:bg-slate-50 transition"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  const total = scoreRatio.coursework + scoreRatio.midterm + scoreRatio.final;
                  if (total !== 100) {
                    setNotice('สัดส่วนรวมต้องเท่ากับ 100 คะแนนพอดี (ปัจจุบัน: ' + total + ')');
                    return;
                  }
                  void saveCloudScoreRatio(session.workspace?.id || '', subjectFilter, scoreRatio);
                  setIsRatioModalOpen(false);
                  setNotice(
                    `บันทึกสัดส่วนเกณฑ์คะแนน (ระหว่างเรียน ${scoreRatio.coursework} : กลางภาค ${scoreRatio.midterm} : ปลายภาค ${scoreRatio.final}) และซิงก์ขึ้นระบบแล้ว`,
                  );
                }}
                className="h-10 rounded-2xl bg-cyan-600 px-5 text-xs font-black text-white shadow-sm hover:bg-cyan-700 transition"
              >
                บันทึกสัดส่วนเกณฑ์
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Edit Assessment Modal Dialog */}
      {isEditModalOpen && editingAssessment ? (
        <div
          aria-labelledby="modal-edit-assessment-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-fade-in"
          role="dialog"
        >
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-50 text-cyan-600">
                  <Edit3 size={20} aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900" id="modal-edit-assessment-title">
                    แก้ไขชุดคะแนน / ปรับน้ำหนัก
                  </h3>
                  <p className="text-xs text-slate-500">
                    วิชา {editingAssessment.subject_name} • ห้อง {classroomById.get(editingAssessment.classroom_id)?.name || ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSaveEditAssessment} className="mt-4 space-y-4">
              <label className="block">
                <span className="text-xs font-black text-slate-600">ชื่อชุดคะแนน</span>
                <input
                  className="nexus-field mt-1.5 h-10 px-3 text-xs font-bold w-full"
                  value={editForm.title}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                  required
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-black text-slate-600">ประเภท</span>
                  <select
                    className="nexus-field mt-1.5 h-10 px-3 text-xs font-bold w-full"
                    value={editForm.category}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, category: e.target.value as AssessmentCategory }))
                    }
                  >
                    {categoryOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-black text-slate-600">วันที่ประเมิน</span>
                  <ThaiDatePicker
                    className="mt-1.5 h-10 px-3 text-xs font-bold"
                    onValueChange={(value) => setEditForm((prev) => ({ ...prev, assessmentDate: value }))}
                    value={editForm.assessmentDate}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-black text-slate-600">คะแนนเต็ม</span>
                  <input
                    type="number"
                    min="1"
                    className="nexus-field mt-1.5 h-10 px-3 text-xs font-bold w-full"
                    value={editForm.maxScore}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, maxScore: e.target.value }))}
                    required
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-black text-slate-600">น้ำหนักคะแนน (%)</span>
                  <input
                    type="number"
                    min="1"
                    className="nexus-field mt-1.5 h-10 px-3 text-xs font-bold w-full"
                    value={editForm.weight}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, weight: e.target.value }))}
                    required
                  />
                  <span className="mt-1 block text-[10px] text-slate-400 font-bold">
                    สัดส่วนผลต่อเกรด 100 คะแนน
                  </span>
                </label>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="h-10 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 hover:bg-slate-50 transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-10 rounded-2xl bg-cyan-600 px-5 text-xs font-black text-white shadow-sm hover:bg-cyan-700 transition disabled:opacity-50"
                >
                  {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
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

      {/* 6. User Guide & Interactive Step-by-Step Navigator Dialog */}
      {isGuideOpen ? (
        <div
          aria-labelledby="modal-score-guide-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-xs"
          role="dialog"
        >
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl animate-scale-up">
            {/* Modal Header */}
            <div className="border-b border-slate-100 bg-gradient-to-r from-slate-950 via-cyan-950 to-slate-900 px-6 py-4 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400/30 backdrop-blur-sm">
                    <BookOpen size={22} aria-hidden="true" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-cyan-400/20 px-2.5 py-0.5 text-[11px] font-black text-cyan-200 ring-1 ring-cyan-400/30">
                        <Sparkles size={11} aria-hidden="true" />
                        ClassCare 360 • System Navigator
                      </span>
                    </div>
                    <h2 className="mt-0.5 text-base sm:text-lg font-black text-white" id="modal-score-guide-title">
                      {guideTab === 'tour' ? 'ตัวนำทางการใช้งานระบบบันทึกคะแนน' : 'คู่มือการใช้งานระบบบันทึกคะแนนฉบับเต็ม'}
                    </h2>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Mode Switcher Tabs */}
                  <div className="hidden sm:inline-flex rounded-xl bg-white/10 p-1 backdrop-blur-xs">
                    <button
                      type="button"
                      onClick={() => setGuideTab('tour')}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-black transition ${
                        guideTab === 'tour'
                          ? 'bg-cyan-500 text-white shadow-xs'
                          : 'text-white/70 hover:text-white'
                      }`}
                    >
                      <Sparkles size={12} />
                      นำทางทีละขั้น
                    </button>
                    <button
                      type="button"
                      onClick={() => setGuideTab('manual')}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-black transition ${
                        guideTab === 'manual'
                          ? 'bg-cyan-500 text-white shadow-xs'
                          : 'text-white/70 hover:text-white'
                      }`}
                    >
                      <BookOpen size={12} />
                      คู่มือฉบับเต็ม
                    </button>
                  </div>

                  <button
                    className="grid h-8 w-8 place-items-center rounded-xl bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white"
                    onClick={() => setIsGuideOpen(false)}
                    type="button"
                    aria-label="ปิดหน้าต่างนำทาง"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* Stepper Progress Indicator (Tour Mode Only) */}
              {guideTab === 'tour' ? (
                <div className="mt-4 pt-3 border-t border-white/10">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300 mb-2">
                    <span className="flex items-center gap-1.5">
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-cyan-500 text-slate-950 font-black text-[10px]">
                        {guideStep}
                      </span>
                      <span>ขั้นตอนที่ {guideStep} จาก {totalGuideSteps}</span>
                    </span>
                    <span className="text-[11px] text-cyan-300">
                      {guideStep === 1 && '1. เลือกโหมดการสอน'}
                      {guideStep === 2 && '2. สลับห้องและวิชา'}
                      {guideStep === 3 && '3. สร้างชุดคะแนน'}
                      {guideStep === 4 && '4. กรอกคะแนนแบบ Excel'}
                      {guideStep === 5 && '5. บันทึกต่อเนื่อง'}
                      {guideStep === 6 && '6. ตัดเกรดและรายงาน'}
                    </span>
                  </div>

                  {/* Visual Step Pills */}
                  <div className="grid grid-cols-6 gap-1.5">
                    {[1, 2, 3, 4, 5, 6].map((step) => {
                      const isPast = step < guideStep;
                      const isCurrent = step === guideStep;
                      return (
                        <button
                          key={step}
                          type="button"
                          onClick={() => setGuideStep(step)}
                          className={`h-2 rounded-full transition-all ${
                            isCurrent
                              ? 'bg-cyan-400 ring-2 ring-cyan-300/50'
                              : isPast
                              ? 'bg-cyan-600/80 hover:bg-cyan-500'
                              : 'bg-white/20 hover:bg-white/30'
                          }`}
                          title={`ไปขั้นตอนที่ ${step}`}
                        />
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Modal Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 text-slate-700">
              {guideTab === 'tour' ? (
                /* Interactive Step-by-Step Walkthrough Views */
                <div className="space-y-4 animate-fade-in">
                  {/* STEP 1: Choose Teaching Perspective */}
                  {guideStep === 1 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-indigo-50 text-indigo-700">
                          <Users size={20} />
                        </div>
                        <div>
                          <span className="text-[11px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                            ขั้นตอนที่ 1 • กำหนดรูปแบบการทำงาน
                          </span>
                          <h3 className="text-base font-black text-slate-900 mt-1">
                            เลือกโหมดการสอนที่คุณครูรับผิดชอบ
                          </h3>
                        </div>
                      </div>

                      <p className="text-xs leading-relaxed text-slate-600">
                        ClassCare 360 ออกแบบให้ตอบโจทย์การทำงานของครู 2 รูปแบบอย่างแท้จริง ให้เลือกโหมดที่ตรงกับภาระหน้าที่ของคุณครู:
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                        <div
                          className={`rounded-2xl border p-4 cursor-pointer transition ${
                            perspective === 'subject'
                              ? 'border-indigo-400 bg-indigo-50/60 ring-2 ring-indigo-200'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                          }`}
                          onClick={() => handlePerspectiveChange('subject')}
                        >
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-2 font-black text-xs text-indigo-950">
                              <BookOpen size={16} className="text-indigo-600" />
                              วิชาสอนหลายห้อง (แนะนำ)
                            </span>
                            {perspective === 'subject' ? (
                              <span className="rounded-full bg-indigo-600 text-white p-0.5"><Check size={12} /></span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-[11px] leading-5 text-slate-600">
                            สำหรับ <strong>ครูผู้สอนเฉพาะวิชา</strong> เช่น ภาษาอังกฤษ หรือ วิทยาศาสตร์ ที่สอนหลายห้อง (ป.5/1, ป.5/2, ป.5/3) ให้เลือกวิชาครั้งเดียว แล้วสลับห้องและเปรียบเทียบผลคะแนนได้ทันที
                          </p>
                          <button
                            type="button"
                            className="mt-3 w-full rounded-xl bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-2xs hover:bg-indigo-700"
                            onClick={() => handlePerspectiveChange('subject')}
                          >
                            {perspective === 'subject' ? '✓ กำลังเลือกโหมดนี้' : 'คลิกเพื่อเลือกโหมดนี้'}
                          </button>
                        </div>

                        <div
                          className={`rounded-2xl border p-4 cursor-pointer transition ${
                            perspective === 'classroom'
                              ? 'border-cyan-400 bg-cyan-50/60 ring-2 ring-cyan-200'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                          }`}
                          onClick={() => handlePerspectiveChange('classroom')}
                        >
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-2 font-black text-xs text-cyan-950">
                              <Users size={16} className="text-cyan-600" />
                              วิชาสอนห้องเดียว / ครูประจำชั้น
                            </span>
                            {perspective === 'classroom' ? (
                              <span className="rounded-full bg-cyan-600 text-white p-0.5"><Check size={12} /></span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-[11px] leading-5 text-slate-600">
                            สำหรับ <strong>ครูประจำชั้น</strong> ที่สอนหลายวิชาในห้องเดียว เลือกห้องเรียนของตนเองก่อน แล้วจัดการทุกวิชาและสรุปเกรดรวมของห้องนั้น
                          </p>
                          <button
                            type="button"
                            className="mt-3 w-full rounded-xl bg-cyan-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-2xs hover:bg-cyan-700"
                            onClick={() => handlePerspectiveChange('classroom')}
                          >
                            {perspective === 'classroom' ? '✓ กำลังเลือกโหมดนี้' : 'คลิกเพื่อเลือกโหมดนี้'}
                          </button>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3.5 flex items-start gap-2 text-slate-600 text-xs">
                        <Info size={16} className="text-cyan-600 shrink-0 mt-0.5" />
                        <p>คุณครูสามารถสลับโหมดนี้ได้ตลอดเวลาที่แถบ <strong>&ldquo;โหมดการทำงาน&rdquo;</strong> ด้านบน</p>
                      </div>
                    </div>
                  )}

                  {/* STEP 2: Quick Room Switcher */}
                  {guideStep === 2 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-50 text-cyan-700">
                          <Table size={20} />
                        </div>
                        <div>
                          <span className="text-[11px] font-black text-cyan-600 bg-cyan-50 px-2.5 py-0.5 rounded-full">
                            ขั้นตอนที่ 2 • การสลับห้องเรียน
                          </span>
                          <h3 className="text-base font-black text-slate-900 mt-1">
                            เลือกวิชาและสลับห้องเรียนใน 1 วินาที
                          </h3>
                        </div>
                      </div>

                      <p className="text-xs leading-relaxed text-slate-600">
                        เมื่ออยู่ในโหมดตามรายวิชา ระบบจะดึงแท็บห้องเรียนทั้งหมดที่สอนวิชานี้มาวางเรียงกันในแนวนอน เพื่อให้คุณครูสลับห้องได้ทันทีโดยไม่ต้องค้นหาใหม่:
                      </p>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                        <p className="text-xs font-bold text-slate-700">ตัวอย่างแท็บห้องเรียนที่คุณครูจะเห็นในระบบ:</p>
                        <div className="flex flex-wrap items-center gap-2">
                          {classrooms.slice(0, 3).map((c, idx) => (
                            <div
                              key={c.id}
                              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-black border ${
                                idx === 0
                                  ? 'bg-slate-950 text-white border-slate-900 shadow-xs'
                                  : 'bg-white text-slate-700 border-slate-200'
                              }`}
                            >
                              <span>ห้อง {c.name}</span>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] ${idx === 0 ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                {students.filter((s) => s.classroom_id === c.id).length || 30} คน
                              </span>
                            </div>
                          ))}
                          <div className="inline-flex items-center gap-1 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-500">
                            + เพิ่มห้องที่สอนวิชานี้...
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5 flex items-start gap-2.5 text-emerald-900 text-xs">
                        <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                        <p>
                          <strong>เคล็ดลับ:</strong> หากคุณครูสอนห้องอื่นเพิ่มเติมในวิชานี้ ให้คลิกเมนู <strong>&ldquo;+ เพิ่มห้องที่สอนวิชานี้...&rdquo;</strong> เพื่อนำห้องใหม่เข้ามาผูกกับวิชานี้ได้ทันที
                        </p>
                      </div>
                    </div>
                  )}

                  {/* STEP 3: Assessment Creation & Cloning */}
                  {guideStep === 3 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-indigo-50 text-indigo-700">
                          <Copy size={20} />
                        </div>
                        <div>
                          <span className="text-[11px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                            ขั้นตอนที่ 3 • การสร้างและกระจายเกณฑ์คะแนน
                          </span>
                          <h3 className="text-base font-black text-slate-900 mt-1">
                            สร้างชุดคะแนนและกระจายทุกห้อง (ไม่ต้องทำซ้ำ)
                          </h3>
                        </div>
                      </div>

                      <p className="text-xs leading-relaxed text-slate-600">
                        คุณครูไม่ต้องเสียเวลาสร้างชุดคะแนนทีละห้องเหมือนระบบเดิมอีกต่อไป ด้วย 2 ฟังก์ชันอัจฉริยะ:
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-2">
                          <div className="flex items-center gap-2 text-indigo-700 font-black text-xs">
                            <Plus size={16} />
                            <span>1. ติ๊กเลือกทุกห้องตอนสร้าง</span>
                          </div>
                          <p className="text-[11px] leading-5 text-slate-600">
                            เวลาคลิก <strong>&ldquo;สร้างชุดคะแนนใหม่&rdquo;</strong> ให้ติ๊กเลือก <strong>[✓] ทุกห้องที่สอนวิชานี้</strong> ระบบจะสร้างชุดคะแนนที่คะแนนเต็มและน้ำหนักตรงกันให้กับทุกห้องในคลิกเดียว
                          </p>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-3 py-1.5 text-xs font-black text-white hover:bg-cyan-700 shadow-2xs"
                            onClick={() => {
                              setIsGuideOpen(false);
                              openCreateAssessmentModal();
                            }}
                          >
                            <Plus size={13} />
                            ลองเปิดหน้าต่างสร้างชุดคะแนน
                          </button>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-2">
                          <div className="flex items-center gap-2 text-indigo-700 font-black text-xs">
                            <Copy size={16} />
                            <span>2. คัดลอกเกณฑ์ไปห้องอื่น</span>
                          </div>
                          <p className="text-[11px] leading-5 text-slate-600">
                            หากมีเกณฑ์คะแนนในห้องแรกอยู่แล้ว (เช่น ป.5/1) สามารถกดปุ่ม <strong>&ldquo;คัดลอกเกณฑ์ไปห้องอื่น&rdquo;</strong> เพื่อโคลนชิ้นงานทั้งหมดไปยัง ป.5/2, ป.5/3 โดยระบบจะตรวจสอบไม่ให้เกิดรายการซ้ำซ้อน
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STEP 4: Spreadsheet Grid & Excel Paste */}
                  {guideStep === 4 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                          <Keyboard size={20} />
                        </div>
                        <div>
                          <span className="text-[11px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                            ขั้นตอนที่ 4 • สเปรดชีตและการกรอกคะแนน
                          </span>
                          <h3 className="text-base font-black text-slate-900 mt-1">
                            กรอกเร็วเหมือน Excel &amp; วางข้อมูลด้วย Ctrl + V
                          </h3>
                        </div>
                      </div>

                      <p className="text-xs leading-relaxed text-slate-600">
                        ตารางรวมแบบ Excel Grid ออกแบบมาเพื่อความรวดเร็วสูงสุด รองรับทั้งการพิมพ์ต่อเนื่องและวางข้อมูล:
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 space-y-2">
                          <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                            <Keyboard size={15} className="text-cyan-600" />
                            ปุ่มคีย์บอร์ดที่แนะนำ:
                          </h4>
                          <ul className="text-[11px] leading-5 text-slate-600 space-y-1">
                            <li>• <kbd className="rounded border bg-slate-100 px-1 font-mono font-bold">Tab</kbd> : เลื่อนไปช่องถัดไปทางขวา</li>
                            <li>• <kbd className="rounded border bg-slate-100 px-1 font-mono font-bold">Enter</kbd> หรือ <kbd className="rounded border bg-slate-100 px-1 font-mono font-bold">↓</kbd> : เลื่อนลงคนถัดไป</li>
                            <li>• <kbd className="rounded border bg-slate-100 px-1 font-mono font-bold">↑ ↓ ← →</kbd> : เลื่อนช่องอิสระเหมือน Excel</li>
                          </ul>
                        </div>

                        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 space-y-2">
                          <h4 className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                            <Lightbulb size={15} className="text-amber-600" />
                            สูตรเด็ด: วางจาก Excel (Ctrl + V)
                          </h4>
                          <p className="text-[11px] leading-5 text-amber-900">
                            หากมีคะแนนในโปรแกรม Excel ให้คลุมแถบคะแนนทั้งคอลัมน์แล้วกด <strong>Ctrl + C</strong> จากนั้นคลิกที่ช่องของนักเรียนคนแรกใน ClassCare แล้วกด <strong>Ctrl + V</strong> คะแนนจะถูกกรอกเรียงทุกคนทันที!
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STEP 5: Continuous Flow */}
                  {guideStep === 5 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-50 text-cyan-700">
                          <Save size={20} />
                        </div>
                        <div>
                          <span className="text-[11px] font-black text-cyan-600 bg-cyan-50 px-2.5 py-0.5 rounded-full">
                            ขั้นตอนที่ 5 • การบันทึกต่อเนื่อง
                          </span>
                          <h3 className="text-base font-black text-slate-900 mt-1">
                            บันทึกและไปห้องถัดไปต่อเนื่อง (Continuous Grading)
                          </h3>
                        </div>
                      </div>

                      <p className="text-xs leading-relaxed text-slate-600">
                        เมื่อคุณครูทำการกรอกหรือแก้ไขคะแนน จะมีแถบสีดำลอยขึ้นมาด้านล่างพร้อมจำนวนคะแนนที่รอการบันทึก:
                      </p>

                      <div className="rounded-2xl bg-slate-950 p-4 text-white space-y-2 shadow-md">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-300">ตัวอย่างแถบบันทึกที่คุณครูจะเห็นด้านล่าง:</span>
                          <span className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-black text-slate-950">บันทึกสด</span>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                          <span className="rounded-xl bg-slate-800 px-3 py-1.5 text-xs text-slate-300 font-bold">ยกเลิก</span>
                          <span className="rounded-xl bg-emerald-500 px-4 py-1.5 text-xs font-black text-white shadow-sm flex items-center gap-1">
                            <Save size={13} />
                            บันทึกคะแนน
                          </span>
                          <span className="rounded-xl bg-[#1C342B] px-4 py-1.5 text-xs font-black text-white shadow-sm inline-flex items-center gap-1">
                            บันทึกแล้วไปห้องถัดไป <ArrowRight size={13} aria-hidden="true" />
                          </span>
                        </div>
                      </div>

                      <p className="text-xs leading-relaxed text-[#5A6F64]">
                        กดปุ่ม <strong>&ldquo;บันทึกแล้วไปห้องถัดไป&rdquo;</strong> เพื่อให้ระบบบันทึกคะแนนห้องปัจจุบัน แล้วเปิดตารางของห้องถัดไปให้ตรวจต่อทันที ไม่ต้องคลิกเลือกห้องใหม่!
                      </p>
                    </div>
                  )}

                  {/* STEP 6: Gradebook Summary & Reports */}
                  {guideStep === 6 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                          <Award size={20} />
                        </div>
                        <div>
                          <span className="text-[11px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                            ขั้นตอนที่ 6 • สรุปผลสัมฤทธิ์และเอกสาร ปพ.5
                          </span>
                          <h3 className="text-base font-black text-slate-900 mt-1">
                            ตัดเกรด 0-4 สพฐ. เปรียบเทียบผล และพิมพ์ ปพ.5
                          </h3>
                        </div>
                      </div>

                      <p className="text-xs leading-relaxed text-slate-600">
                        เมื่อกรอกคะแนนเรียบร้อย คุณครูสามารถใช้ 4 เมนูหลักด้านบนเพื่อสรุปผลและรายงาน:
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 space-y-1.5">
                          <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                            <FileSpreadsheet size={15} className="text-cyan-600" />
                            3. สรุป &amp; ตัดเกรด (0 - 4)
                          </h4>
                          <p className="text-[11px] leading-5 text-slate-600">
                            ดูการคำนวณคะแนนสะสม กลางภาค ปลายภาค ร้อยละ และตัดเกรด 8 ระดับตามเกณฑ์กระทรวงศึกษาธิการ
                          </p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 space-y-1.5">
                          <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                            <BarChart3 size={15} className="text-indigo-600" />
                            4. เปรียบเทียบผลสัมฤทธิ์ ({classroomsWithSubject.length} ห้อง)
                          </h4>
                          <p className="text-[11px] leading-5 text-slate-600">
                            ดูสถิติเปรียบเทียบคะแนนเฉลี่ย อัตราส่งงาน และการกระจายเกรดระหว่างห้องเรียนในวิชาเดียวกัน
                          </p>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 flex items-start gap-2.5 text-slate-700 text-xs">
                        <Download size={16} className="text-cyan-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">การนำข้อมูลออกและจัดพิมพ์:</p>
                          <p className="mt-0.5 text-slate-500">
                            กดปุ่ม <strong>&ldquo;Export Excel&rdquo;</strong> เพื่อดาวน์โหลดสเปรดชีต หรือไปที่เมนู <strong>&ldquo;รายงาน (Reports)&rdquo;</strong> เพื่อพิมพ์แบบบันทึกผลการเรียน ปพ.5 ทางการ
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Full Reference Manual Mode */
                <div className="space-y-6 animate-fade-in">
                  {/* 1. Quick Start 3 Steps */}
                  <section className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                      <span className="grid h-6 w-6 place-items-center rounded-lg bg-cyan-100 text-cyan-800 text-xs">1</span>
                      <h3>เริ่มต้นใช้งานด่วนใน 3 ขั้นตอน</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                        <div className="flex items-center gap-2 text-cyan-700">
                          <Table size={16} />
                          <h4 className="text-xs font-black text-slate-900">1. เลือกห้องและวิชา</h4>
                        </div>
                        <p className="mt-1.5 text-xs font-medium leading-5 text-slate-600">
                          เลือกวิชาและแท็บห้องเรียนจากแถบด้านบน หากยังไม่มีชิ้นงานให้กดปุ่ม <strong>&ldquo;สร้างชุดคะแนนใหม่&rdquo;</strong>
                        </p>
                      </div>

                      <div className="rounded-2xl border border-cyan-200 bg-cyan-50/50 p-4">
                        <div className="flex items-center gap-2 text-cyan-800">
                          <Copy size={16} />
                          <h4 className="text-xs font-black text-slate-900">2. กรอกหรือวางคะแนน</h4>
                        </div>
                        <p className="mt-1.5 text-xs font-medium leading-5 text-slate-600">
                          คลิกช่องเพื่อพิมพ์คะแนนโดยตรง หรือ <strong>Copy จากไฟล์ Excel</strong> มากด <strong>Ctrl + V</strong> วางลงทั้งคอลัมน์ได้ทันที
                        </p>
                      </div>

                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
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

                  {/* 3. Thai Grade Scale 0-4 */}
                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                        <Award size={18} className="text-cyan-700" />
                        <h3>เกณฑ์การตัดเกรด 8 ระดับ (มาตรฐาน สพฐ. / ศธ.)</h3>
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
                </div>
              )}
            </div>

            {/* Modal Navigation Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <div className="flex items-center gap-2">
                {guideTab === 'tour' && guideStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => setGuideStep((s) => Math.max(1, s - 1))}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
                  >
                    <ArrowLeft size={14} />
                    ย้อนกลับ
                  </button>
                ) : null}

                <span className="text-xs text-slate-400 font-bold hidden sm:inline">
                  {guideTab === 'tour' ? `ก้าวที่ ${guideStep} จาก ${totalGuideSteps}` : 'ClassCare 360 Score Manual'}
                </span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setIsGuideOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-200/60 transition"
                >
                  ข้ามไกด์
                </button>

                {guideTab === 'tour' && guideStep < totalGuideSteps ? (
                  <button
                    type="button"
                    onClick={() => setGuideStep((s) => Math.min(totalGuideSteps, s + 1))}
                    className="inline-flex items-center gap-1.5 rounded-2xl bg-cyan-600 px-5 py-2.5 text-xs font-black text-white shadow-md shadow-cyan-600/20 hover:bg-cyan-700 transition"
                  >
                    <span>ขั้นตอนถัดไป ({guideStep + 1}/{totalGuideSteps})</span>
                    <ArrowRight size={14} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsGuideOpen(false)}
                    className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-2.5 text-xs font-black text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition"
                  >
                    <CheckCircle2 size={16} />
                    <span>เริ่มบันทึกคะแนนเลย!</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <Suspense fallback={null}>
        {selectedAssessment ? (
          <ScoreOcrModal
            assessmentTitle={selectedAssessment.title}
            isOpen={isScoreOcrOpen}
            maxScore={selectedAssessment.max_score}
            onApplyScores={handleApplyScoreOcr}
            onClose={() => setIsScoreOcrOpen(false)}
            session={session}
            students={classroomStudents.map((s, idx) => ({
              id: s.id,
              student_code: s.student_code,
              name: `${s.first_name} ${s.last_name}`,
              number: idx + 1,
            }))}
          />
        ) : null}

        <RubricAndQuizModal
          defaultGradeLevel={activeClassroom?.name?.split('/')[0] || 'ป.5'}
          defaultSubject={subjectFilter || 'คณิตศาสตร์'}
          isOpen={isRubricModalOpen}
          onClose={() => setIsRubricModalOpen(false)}
          session={session}
        />

        <AcademicSubjectsModal
          academicYear={activeClassroom?.academic_year || session.workspace?.academicYear || '2569'}
          currentClassroomId={activeClassroom?.id}
          currentClassroomName={activeClassroom?.name}
          isOpen={isAcademicSubjectsOpen}
          onClose={() => {
            setIsAcademicSubjectsOpen(false);
            void reloadSchoolSubjects();
          }}
          session={session}
          term={activeAcademicTerm}
        />

        <OfficialAcademicDocumentsModal
          academicYear={activeClassroom?.academic_year || session.workspace?.academicYear || '2569'}
          currentClassroomId={activeClassroom?.id}
          currentClassroomName={activeClassroom?.name}
          isOpen={isOfficialDocumentsOpen}
          onClose={() => setIsOfficialDocumentsOpen(false)}
          session={session}
          term={activeAcademicTerm}
        />

        <TermClosingWizardModal
          academicYear={activeClassroom?.academic_year || session.workspace?.academicYear || '2569'}
          currentClassroomId={activeClassroom?.id}
          currentClassroomName={activeClassroom?.name}
          isOpen={isTermClosingOpen}
          onClose={() => setIsTermClosingOpen(false)}
          session={session}
          term={activeAcademicTerm}
        />
      </Suspense>

      <footer className="mt-8 text-center text-xs font-bold text-slate-400">
        Created by MIKPURINUT • ClassCare 360
      </footer>
    </main>
  );
}
