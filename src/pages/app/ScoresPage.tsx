import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Download,
  FileSpreadsheet,
  Gauge,
  HelpCircle,
  Layers,
  Plus,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
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
import type { AppSessionContext } from '../../types/core';

interface ScoresPageProps {
  session: AppSessionContext;
}

type AssessmentCategory = 'quiz' | 'assignment' | 'midterm' | 'final' | 'exam' | 'project' | 'reading' | 'other';
type AssessmentStatus = 'draft' | 'published' | 'archived';
type ScoreBand = 'coursework' | 'midterm' | 'final';
type ScoreView = 'overview' | 'setup' | 'entry' | 'gradebook';

const scoreViewValues = ['overview', 'setup', 'entry', 'gradebook'] as const;

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
    assessment_date: getBangkokDate(),
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
    assessment_date: getBangkokDate(new Date(Date.now() - 1000 * 60 * 60 * 24 * 4)),
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
  {
    assessment_date: getBangkokDate(new Date(Date.now() - 1000 * 60 * 60 * 24 * 9)),
    category: 'midterm',
    classroom_id: 'demo-classroom',
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
    classroom_id: 'demo-classroom',
    created_by: 'demo-teacher',
    id: 'demo-assessment-4',
    max_score: 30,
    status: 'draft',
    subject_name: 'คณิตศาสตร์',
    title: 'สอบปลายภาค',
    weight: 30,
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
  const demoMode = isDemoSession(session);
  const location = useLocation();
  const navigate = useNavigate();
  const requestedScoreView = new URLSearchParams(location.search).get('scoreView');
  const initialScoreView = isScoreView(requestedScoreView) ? requestedScoreView : 'entry';
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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    const nextScoreView = isScoreView(requestedScoreView) ? requestedScoreView : 'entry';
    if (nextScoreView !== scoreView) {
      setScoreView(nextScoreView);
    }
  }, [requestedScoreView, scoreView]);

  function handleScoreViewChange(nextScoreView: ScoreView) {
    setScoreView(nextScoreView);
    navigate(withDemoContext(`/app/dashboard?view=scores&scoreView=${nextScoreView}`, location.search), { replace: true });
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

  const subjectOptions = useMemo(() => {
    const subjects = classroomAssessments.map((assessment) => assessment.subject_name.trim()).filter(Boolean);
    const currentSubject = form.subjectName.trim();
    if (currentSubject) subjects.push(currentSubject);
    return Array.from(new Set(subjects)).sort((a, b) => a.localeCompare(b, 'th'));
  }, [classroomAssessments, form.subjectName]);

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

    if (!supabase || !session.workspace || isDemoSession(session)) {
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
      setSubjectFilter(subjectName);
      setSelectedAssessmentId(assessment.id);
      setForm((current) => ({ ...current, title: '' }));
      setIsCreateModalOpen(false);
      handleScoreViewChange('entry');
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
    setSubjectFilter(assessment.subject_name);
    setSelectedAssessmentId(assessment.id);
    setForm((current) => ({ ...current, title: '' }));
    setIsCreateModalOpen(false);
    handleScoreViewChange('entry');
    setNotice('สร้างชุดคะแนนแล้ว');
    setIsSubmitting(false);
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
            { icon: ClipboardList, label: 'กรอกคะแนน', value: 'entry' as ScoreView },
            { icon: FileSpreadsheet, label: 'สมุดรวม & ตัดเกรด (0 - 4)', value: 'gradebook' as ScoreView },
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

      {/* 2. Unified Context Selector & Quick Action Bar */}
      <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="แถบควบคุมห้องและวิชา">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            {/* Classroom Select */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-500 shrink-0">ห้องเรียน:</span>
              <select
                className="h-10 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-xs font-black text-slate-800 outline-none transition focus:border-cyan-400 focus:bg-white"
                onChange={(event) => setClassroomId(event.target.value)}
                value={classroomId}
              >
                {classrooms.map((classroom) => (
                  <option key={classroom.id} value={classroom.id}>
                    {classroom.name} {classroom.academic_year ? `(${classroom.academic_year})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Subject Select */}
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

            {/* Assessment Select (Shown when in entry view) */}
            {scoreView === 'entry' && contextAssessments.length > 0 ? (
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
          <div className="flex items-center gap-2 shrink-0">
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-4 text-xs font-black text-white shadow-sm transition hover:bg-cyan-700"
              onClick={() => setIsCreateModalOpen(true)}
              type="button"
            >
              <Plus size={15} aria-hidden="true" />
              สร้างชุดคะแนนใหม่
            </button>
            {scoreView === 'entry' && selectedAssessment ? (
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

      {/* 3A: ENTRY VIEW */}
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

      {/* 4. Sticky Floating Save Bar (Triggered when there are unsaved edits) */}
      {unsavedCount > 0 && selectedAssessment ? (
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
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-black text-slate-600">ห้องเรียน</span>
                  <select
                    className="nexus-field mt-1.5 h-10 px-3 text-xs font-bold"
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
                  <span className="text-xs font-black text-slate-600">วิชา</span>
                  <input
                    className="nexus-field mt-1.5 h-10 px-3 text-xs font-bold"
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

      <footer className="mt-8 text-center text-xs font-bold text-slate-400">
        Created by MIKPURINUT • ClassCare 360
      </footer>
    </main>
  );
}
