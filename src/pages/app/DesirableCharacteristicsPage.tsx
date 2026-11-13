import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Download,
  Filter,
  GraduationCap,
  HelpCircle,
  LayoutGrid,
  ListFilter,
  Pencil,
  Printer,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Star,
  UserCheck,
  Users,
  X,
} from 'lucide-react';

import { writeAuditLog } from '../../lib/auditLog';
import { isDemoSession } from '../../lib/auth';
import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import { getClassroomScopeBadge, getTeacherClassroomScope } from '../../lib/teacherClassrooms';
import { downloadExcelBuffer } from '../../lib/excelReport';
import ExcelJS from 'exceljs';
import type { AppSessionContext } from '../../types/core';

interface DesirableCharacteristicsPageProps {
  session: AppSessionContext;
}

export type EvaluationLevel = 3 | 2 | 1 | 0;

export interface TraitDefinition {
  id: number;
  shortName: string;
  name: string;
  description: string;
}

export const OBEC_TRAITS: TraitDefinition[] = [
  { id: 1, shortName: '1. รักชาติฯ', name: '1. รักชาติ ศาสน์ กษัตริย์', description: 'แสดงออกถึงความภูมิใจในความเป็นชาติ ยึดมั่นในศาสนา และเคารพเทิดทูนสถาบันพระมหากษัตริย์' },
  { id: 2, shortName: '2. ซื่อสัตย์', name: '2. ซื่อสัตย์สุจริต', description: 'ประพฤติตรงตามความเป็นจริงต่อตนเองและผู้อื่น ไม่ลักขโมย มีความซื่อตรง' },
  { id: 3, shortName: '3. มีวินัย', name: '3. มีวินัย', description: 'ปฏิบัติตามข้อตกลง กฎระเบียบ ข้อบังคับของโรงเรียนและสังคม ตรงต่อเวลา' },
  { id: 4, shortName: '4. ใฝ่เรียนรู้', name: '4. ใฝ่เรียนรู้', description: 'ตั้งใจ เพียรพยายามในการเรียน เข้าร่วมกิจกรรมการเรียนรู้ ค้นคว้าหาความรู้ด้วยตนเอง' },
  { id: 5, shortName: '5. อยู่อย่างพอเพียง', name: '5. อยู่อย่างพอเพียง', description: 'ดำเนินชีวิตอย่างพอประมาณ มีเหตุผล รอบคอบ รู้จักประหยัดและใช้จ่ายอย่างคุ้มค่า' },
  { id: 6, shortName: '6. มุ่งมั่นทำงาน', name: '6. มุ่งมั่นในการทำงาน', description: 'เอาใจใส่และรับผิดชอบต่อหน้าที่ ทำงานให้สำเร็จตามเป้าหมาย มีความอดทน' },
  { id: 7, shortName: '7. รักความเป็นไทย', name: '7. รักความเป็นไทย', description: 'ภาคภูมิใจในขนบธรรมเนียม ประเพณี ศิลปะ วัฒนธรรมไทย และใช้ภาษาไทยอย่างถูกต้อง' },
  { id: 8, shortName: '8. จิตสาธารณะ', name: '8. มีจิตสาธารณะ', description: 'ช่วยเหลือผู้อื่น บำเพ็ญประโยชน์เพื่อส่วนรวม ดูแลรักษาทรัพย์สินส่วนรวม' },
];

export const READING_INDICATORS: TraitDefinition[] = [
  { id: 1, shortName: '1. การอ่าน', name: '1. สามารถอ่านเพื่อค้นคว้า', description: 'อ่านข้อความ สารสนเทศ สื่อสิ่งพิมพ์และอิเล็กทรอนิกส์ได้อย่างถูกต้องและคล่องแคล่ว' },
  { id: 2, shortName: '2. จับใจความ', name: '2. จับใจความและสรุปความ', description: 'จับประเด็นสำคัญ สรุปสาระสำคัญจากเรื่องที่อ่านได้อย่างครบถ้วน' },
  { id: 3, shortName: '3. คิดวิเคราะห์', name: '3. การคิดวิเคราะห์แยกแยะ', description: 'วิเคราะห์ข้อเท็จจริง ข้อคิดเห็น และเชื่อมโยงความรู้กับประสบการณ์เดิมได้' },
  { id: 4, shortName: '4. ความคิดเห็น', name: '4. แสดงความคิดเห็นอย่างมีเหตุผล', description: 'แสดงความคิดเห็น วิพากษ์ วิจารณ์ หรือเสนอแนะแนวคิดใหม่ได้อย่างสมเหตุสมผล' },
  { id: 5, shortName: '5. การเขียน', name: '5. เขียนสื่อความและถ่ายทอด', description: 'เขียนสื่อความ ถ่ายทอดความรู้ความคิดอย่างเป็นลำดับขั้นตอนและถูกต้องตามหลักภาษา' },
];

export const LEVEL_LABELS: Record<EvaluationLevel, { label: string; short: string; color: string; bg: string; border: string; ring: string }> = {
  3: { label: 'ดีเยี่ยม (3)', short: 'ดีเยี่ยม', color: 'text-emerald-800', bg: 'bg-emerald-500', border: 'border-emerald-300', ring: 'ring-emerald-500' },
  2: { label: 'ดี (2)', short: 'ดี', color: 'text-sky-800', bg: 'bg-sky-500', border: 'border-sky-300', ring: 'ring-sky-500' },
  1: { label: 'ผ่าน (1)', short: 'ผ่าน', color: 'text-amber-800', bg: 'bg-amber-500', border: 'border-amber-300', ring: 'ring-amber-500' },
  0: { label: 'ไม่ผ่าน (0)', short: 'ไม่ผ่าน', color: 'text-rose-800', bg: 'bg-rose-500', border: 'border-rose-300', ring: 'ring-rose-500' },
};

interface StudentRecord {
  id: string;
  student_code: string | null;
  first_name: string;
  last_name: string;
  nickname: string | null;
  classroom_id: string | null;
}

interface ClassroomRecord {
  id: string;
  name: string;
  academic_year: string | null;
  homeroom_teacher_profile_id?: string | null;
}

interface EvaluationRow {
  student_id: string;
  traits: Record<number, EvaluationLevel>;
  trait_summary: EvaluationLevel;
  reading: Record<number, EvaluationLevel>;
  reading_summary: EvaluationLevel;
  note: string;
  isDirty?: boolean;
}

// Auto-calculate summary level following OBEC criteria
function calculateObecSummary(scores: EvaluationLevel[]): EvaluationLevel {
  if (scores.some((s) => s === 0)) return 0;
  const count3 = scores.filter((s) => s === 3).length;
  // If at least 5 out of 8 (or majority) are 3 and none are less than 2 -> Excellent (3)
  const minRequired3 = scores.length >= 8 ? 5 : 3;
  if (count3 >= minRequired3 && !scores.some((s) => s < 2)) {
    return 3;
  }
  // If no 0 and at least all are 1 or 2 -> Good (2)
  if (scores.every((s) => s >= 2) || count3 >= 2) {
    return 2;
  }
  return 1;
}

const NOTE_ROTATIONS = ['rotate-[-1.5deg]', 'rotate-[1deg]', 'rotate-[-0.8deg]', 'rotate-[1.8deg]', 'rotate-[-1deg]', 'rotate-[0.8deg]'];

export function DesirableCharacteristicsPage({ session }: DesirableCharacteristicsPageProps) {
  const [viewMode, setViewMode] = useState<'board' | 'table'>('board');
  const [selectedIndicatorId, setSelectedIndicatorId] = useState<number | 'summary'>('summary');
  const [sheetStudent, setSheetStudent] = useState<StudentRecord | null>(null);

  const [classrooms, setClassrooms] = useState<ClassroomRecord[]>([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>('');
  const [academicYear, setAcademicYear] = useState<string>('2569');
  const [term, setTerm] = useState<'1' | '2' | 'yearly'>('1');
  const [activeTab, setActiveTab] = useState<'traits' | 'reading' | 'overview'>('traits');

  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [evaluations, setEvaluations] = useState<Record<string, EvaluationRow>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'needs_attention' | 'excellent'>('all');

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const workspaceId = session.workspace?.id || 'demo-workspace';

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. Fetch Classrooms
  useEffect(() => {
    async function loadClassrooms() {
      if (isDemoSession(session) || !isSupabaseReady || !supabase || !session.workspace) {
        const dummyRooms: ClassroomRecord[] = [
          { id: 'demo-c1', name: 'ป.5/1', academic_year: '2569' },
          { id: 'demo-c2', name: 'ป.5/2', academic_year: '2569' },
          { id: 'demo-c3', name: 'ป.6/1', academic_year: '2569' },
        ];
        setClassrooms(dummyRooms);
        setSelectedClassroomId(dummyRooms[0].id);
        return;
      }

      const { data, error } = await supabase
        .from('classrooms')
        .select('id, name, academic_year, homeroom_teacher_profile_id')
        .eq('workspace_id', workspaceId)
        .order('name');

      if (!error && data && data.length > 0) {
        const rawRooms = data as ClassroomRecord[];
        const scope = getTeacherClassroomScope(session, rawRooms);
        const filtered = scope.allClassrooms.length > 0 ? scope.allClassrooms : rawRooms;
        setClassrooms(filtered);
        setSelectedClassroomId(scope.defaultClassroomId || filtered[0]?.id || rawRooms[0].id);
        if (filtered[0]?.academic_year) {
          setAcademicYear(filtered[0].academic_year);
        }
      }
    }
    loadClassrooms();
  }, [session, workspaceId]);

  // 2. Fetch Students & Existing Evaluations for selected Classroom
  useEffect(() => {
    if (!selectedClassroomId) return;

    let isMounted = true;
    setIsLoading(true);

    async function loadData() {
      if (isDemoSession(session) || !isSupabaseReady || !supabase) {
        // Demo mock data
        const demoStus: StudentRecord[] = [
          { id: 'demo-s1', student_code: '001', first_name: 'ณัฐวุฒิ', last_name: 'ใจดี', nickname: 'นัท', classroom_id: selectedClassroomId },
          { id: 'demo-s2', student_code: '002', first_name: 'พิมพ์ชนก', last_name: 'แสงทอง', nickname: 'พิม', classroom_id: selectedClassroomId },
          { id: 'demo-s3', student_code: '003', first_name: 'กิตติพงศ์', last_name: 'สุขใจ', nickname: 'ก้อง', classroom_id: selectedClassroomId },
          { id: 'demo-s4', student_code: '004', first_name: 'ศิริพร', last_name: 'วงศ์สวัสดิ์', nickname: 'แพรว', classroom_id: selectedClassroomId },
          { id: 'demo-s5', student_code: '005', first_name: 'ธนากร', last_name: 'รุ่งเรือง', nickname: 'บูม', classroom_id: selectedClassroomId },
        ];

        if (!isMounted) return;
        setStudents(demoStus);

        // Check local storage for existing evaluations
        const cacheKey = `classcare_traits_${workspaceId}_${selectedClassroomId}_${academicYear}_${term}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            setEvaluations(JSON.parse(cached));
            setIsLoading(false);
            return;
          } catch {
            // ignore
          }
        }

        // Initialize default evaluations
        const initial: Record<string, EvaluationRow> = {};
        demoStus.forEach((s) => {
          initial[s.id] = {
            student_id: s.id,
            traits: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3 },
            trait_summary: 3,
            reading: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3 },
            reading_summary: 3,
            note: '',
            isDirty: false,
          };
        });
        setEvaluations(initial);
        setIsLoading(false);
        return;
      }

      try {
        // 1. Fetch Students in classroom
        const { data: stuData, error: stuError } = await supabase
          .from('students')
          .select('id, student_code, first_name, last_name, nickname, classroom_id')
          .eq('workspace_id', workspaceId)
          .eq('classroom_id', selectedClassroomId)
          .eq('status', 'active')
          .order('student_code', { ascending: true, nullsFirst: false });

        if (stuError) throw stuError;
        const currentStudents = (stuData || []) as StudentRecord[];
        if (!isMounted) return;
        setStudents(currentStudents);

        // 2. Fetch existing evaluations from Supabase
        const evalMap: Record<string, EvaluationRow> = {};

        // Try querying student_desirable_records table
        const { data: evalRecords, error: evalError } = await supabase
          .from('student_desirable_records')
          .select('*')
          .eq('workspace_id', workspaceId)
          .eq('classroom_id', selectedClassroomId)
          .eq('academic_year', academicYear)
          .eq('term', term);

        const loadedRecords = (!evalError && evalRecords) ? evalRecords : [];

        // Check localStorage fallback in case table hasn't been migrated or offline
        const cacheKey = `classcare_traits_${workspaceId}_${selectedClassroomId}_${academicYear}_${term}`;
        let localCache: Record<string, EvaluationRow> = {};
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) localCache = JSON.parse(cached);
        } catch {
          // ignore
        }

        currentStudents.forEach((s) => {
          const rec = loadedRecords.find((r: any) => r.student_id === s.id);
          const localRec = localCache[s.id];

          if (rec) {
            evalMap[s.id] = {
              student_id: s.id,
              traits: {
                1: (rec.trait_1 ?? 3) as EvaluationLevel,
                2: (rec.trait_2 ?? 3) as EvaluationLevel,
                3: (rec.trait_3 ?? 3) as EvaluationLevel,
                4: (rec.trait_4 ?? 3) as EvaluationLevel,
                5: (rec.trait_5 ?? 3) as EvaluationLevel,
                6: (rec.trait_6 ?? 3) as EvaluationLevel,
                7: (rec.trait_7 ?? 3) as EvaluationLevel,
                8: (rec.trait_8 ?? 3) as EvaluationLevel,
              },
              trait_summary: (rec.trait_summary ?? 3) as EvaluationLevel,
              reading: {
                1: (rec.reading_1 ?? 3) as EvaluationLevel,
                2: (rec.reading_2 ?? 3) as EvaluationLevel,
                3: (rec.reading_3 ?? 3) as EvaluationLevel,
                4: (rec.reading_4 ?? 3) as EvaluationLevel,
                5: (rec.reading_5 ?? 3) as EvaluationLevel,
              },
              reading_summary: (rec.reading_summary ?? 3) as EvaluationLevel,
              note: rec.note || '',
              isDirty: false,
            };
          } else if (localRec) {
            evalMap[s.id] = { ...localRec, isDirty: false };
          } else {
            // Default preset is 3 (ดีเยี่ยม) for convenience
            evalMap[s.id] = {
              student_id: s.id,
              traits: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3 },
              trait_summary: 3,
              reading: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3 },
              reading_summary: 3,
              note: '',
              isDirty: false,
            };
          }
        });

        if (isMounted) {
          setEvaluations(evalMap);
        }
      } catch (err) {
        console.error('Failed to load students or evaluations:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [selectedClassroomId, academicYear, term, session]);

  // Handle Score Updates
  const updateTrait = (studentId: string, traitId: number, value: EvaluationLevel) => {
    setEvaluations((prev) => {
      const current = prev[studentId] || {
        student_id: studentId,
        traits: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3 },
        trait_summary: 3,
        reading: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3 },
        reading_summary: 3,
        note: '',
      };
      const updatedTraits = { ...current.traits, [traitId]: value };
      const newSummary = calculateObecSummary(Object.values(updatedTraits));

      return {
        ...prev,
        [studentId]: {
          ...current,
          traits: updatedTraits,
          trait_summary: newSummary,
          isDirty: true,
        },
      };
    });
  };

  const updateReading = (studentId: string, indicatorId: number, value: EvaluationLevel) => {
    setEvaluations((prev) => {
      const current = prev[studentId] || {
        student_id: studentId,
        traits: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3 },
        trait_summary: 3,
        reading: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3 },
        reading_summary: 3,
        note: '',
      };
      const updatedReading = { ...current.reading, [indicatorId]: value };
      const newSummary = calculateObecSummary(Object.values(updatedReading));

      return {
        ...prev,
        [studentId]: {
          ...current,
          reading: updatedReading,
          reading_summary: newSummary,
          isDirty: true,
        },
      };
    });
  };

  const updateSummaryOverride = (studentId: string, type: 'traits' | 'reading', val: EvaluationLevel) => {
    setEvaluations((prev) => {
      const current = prev[studentId];
      if (!current) return prev;
      return {
        ...prev,
        [studentId]: {
          ...current,
          ...(type === 'traits' ? { trait_summary: val } : { reading_summary: val }),
          isDirty: true,
        },
      };
    });
  };

  // 1-Click Preset Everyone to 3 (ดีเยี่ยม)
  const setAllToExcellent = () => {
    if (students.length === 0) return;
    const confirmed = window.confirm(`ต้องการตั้งต้นนักเรียนทุกคนในห้อง (${students.length} คน) เป็น "ระดับ 3 (ดีเยี่ยม)" ทั้งหมดใช่หรือไม่?`);
    if (!confirmed) return;

    setEvaluations((prev) => {
      const next = { ...prev };
      students.forEach((s) => {
        next[s.id] = {
          student_id: s.id,
          traits: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3 },
          trait_summary: 3,
          reading: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3 },
          reading_summary: 3,
          note: next[s.id]?.note || '',
          isDirty: true,
        };
      });
      return next;
    });
    showToast('ตั้งต้นทุกคนเป็นระดับ 3 (ดีเยี่ยม) เรียบร้อยแล้ว');
  };

  // Set Column to specific level
  const setColumnToLevel = (type: 'traits' | 'reading', itemId: number, level: EvaluationLevel) => {
    setEvaluations((prev) => {
      const next = { ...prev };
      students.forEach((s) => {
        const cur = next[s.id];
        if (!cur) return;
        if (type === 'traits') {
          const updatedTraits = { ...cur.traits, [itemId]: level };
          next[s.id] = {
            ...cur,
            traits: updatedTraits,
            trait_summary: calculateObecSummary(Object.values(updatedTraits)),
            isDirty: true,
          };
        } else {
          const updatedReading = { ...cur.reading, [itemId]: level };
          next[s.id] = {
            ...cur,
            reading: updatedReading,
            reading_summary: calculateObecSummary(Object.values(updatedReading)),
            isDirty: true,
          };
        }
      });
      return next;
    });
    showToast(`ปรับทั้งคอลัมน์เป็นระดับ ${level} เรียบร้อยแล้ว`);
  };

  const handleNoteCycle = (studentId: string) => {
    const ev = evaluations[studentId];
    if (activeTab === 'reading') {
      if (selectedIndicatorId === 'summary') {
        const cur = ev?.reading_summary ?? 3;
        const nextLevel: EvaluationLevel = cur === 3 ? 2 : cur === 2 ? 1 : cur === 1 ? 0 : 3;
        updateSummaryOverride(studentId, 'reading', nextLevel);
      } else {
        const cur = ev?.reading[selectedIndicatorId] ?? 3;
        const nextLevel: EvaluationLevel = cur === 3 ? 2 : cur === 2 ? 1 : cur === 1 ? 0 : 3;
        updateReading(studentId, selectedIndicatorId, nextLevel);
      }
    } else {
      // traits
      if (selectedIndicatorId === 'summary') {
        const cur = ev?.trait_summary ?? 3;
        const nextLevel: EvaluationLevel = cur === 3 ? 2 : cur === 2 ? 1 : cur === 1 ? 0 : 3;
        updateSummaryOverride(studentId, 'traits', nextLevel);
      } else {
        const cur = ev?.traits[selectedIndicatorId] ?? 3;
        const nextLevel: EvaluationLevel = cur === 3 ? 2 : cur === 2 ? 1 : cur === 1 ? 0 : 3;
        updateTrait(studentId, selectedIndicatorId, nextLevel);
      }
    }
  };

  // Save to Database + LocalStorage Fallback
  const handleSave = async () => {
    setIsSaving(true);
    const cacheKey = `classcare_traits_${workspaceId}_${selectedClassroomId}_${academicYear}_${term}`;

    try {
      // 1. Save to local storage for offline resilience
      localStorage.setItem(cacheKey, JSON.stringify(evaluations));

      // 2. Save to Supabase if available
      if (!isDemoSession(session) && isSupabaseReady && supabase) {
        const recordsToUpsert = Object.values(evaluations).map((ev) => ({
          workspace_id: workspaceId,
          classroom_id: selectedClassroomId,
          student_id: ev.student_id,
          academic_year: academicYear,
          term: term,
          trait_1: ev.traits[1] ?? 3,
          trait_2: ev.traits[2] ?? 3,
          trait_3: ev.traits[3] ?? 3,
          trait_4: ev.traits[4] ?? 3,
          trait_5: ev.traits[5] ?? 3,
          trait_6: ev.traits[6] ?? 3,
          trait_7: ev.traits[7] ?? 3,
          trait_8: ev.traits[8] ?? 3,
          trait_summary: ev.trait_summary ?? 3,
          reading_1: ev.reading[1] ?? 3,
          reading_2: ev.reading[2] ?? 3,
          reading_3: ev.reading[3] ?? 3,
          reading_4: ev.reading[4] ?? 3,
          reading_5: ev.reading[5] ?? 3,
          reading_summary: ev.reading_summary ?? 3,
          note: ev.note || null,
          recorded_by: session.profile?.id || null,
          updated_at: new Date().toISOString(),
        }));

        const { error } = await supabase
          .from('student_desirable_records')
          .upsert(recordsToUpsert, { onConflict: 'workspace_id,classroom_id,student_id,academic_year,term' });

        if (error) {
          console.warn('Could not save to Supabase directly (table may be pending migration), saved to local secure cache:', error.message);
        }
      }

      // Mark clean
      setEvaluations((prev) => {
        const clean: Record<string, EvaluationRow> = {};
        Object.keys(prev).forEach((k) => {
          clean[k] = { ...prev[k], isDirty: false };
        });
        return clean;
      });

      await writeAuditLog(session, {
        action: 'desirable_characteristics.evaluated',
        entityId: selectedClassroomId,
        entityTable: 'student_desirable_records',
        metadata: {
          academicYear,
          classroomName: currentClassroom?.name || selectedClassroomId,
          count: students.length,
          term,
        },
      });

      showToast('บันทึกผลการประเมินเรียบร้อยแล้ว');
    } catch (err: any) {
      console.error('Error saving evaluations:', err);
      showToast('บันทึกข้อมูลในเครื่องเรียบร้อยแล้ว (ออฟไลน์โหมด)');
    } finally {
      setIsSaving(false);
    }
  };

  // Export to Excel (แบบ ปพ.5 มาตรฐาน สพฐ.)
  const handleExportExcel = async () => {
    const classroomName = currentClassroom?.name || 'ห้องเรียน';
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ClassCare 360';
    workbook.created = new Date();

    // Sheet 1: คุณลักษณะอันพึงประสงค์ 8 ประการ
    const ws1 = workbook.addWorksheet('คุณลักษณะ 8 ประการ');
    ws1.pageSetup = { orientation: 'landscape', paperSize: 9 };

    ws1.addRow([`แบบประเมินคุณลักษณะอันพึงประสงค์ 8 ประการ ตามหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พ.ศ. 2551`]);
    ws1.addRow([`ชั้น ${classroomName}  ปีการศึกษา ${academicYear}  ${term === 'yearly' ? 'ตลอดปีการศึกษา' : `ภาคเรียนที่ ${term}`}`]);
    ws1.addRow([]);

    const headers1 = [
      'เลขที่',
      'รหัสนักเรียน',
      'ชื่อ - นามสกุล',
      '1. รักชาติฯ',
      '2. ซื่อสัตย์',
      '3. มีวินัย',
      '4. ใฝ่เรียนรู้',
      '5. พอเพียง',
      '6. มุ่งมั่นทำงาน',
      '7. รักไทย',
      '8. จิตสาธารณะ',
      'สรุปผลคุณลักษณะ',
      'ระดับคุณภาพ',
    ];
    ws1.addRow(headers1);

    students.forEach((s, idx) => {
      const ev = evaluations[s.id];
      const summaryLevel = ev?.trait_summary ?? 3;
      ws1.addRow([
        idx + 1,
        s.student_code || '-',
        `${s.first_name} ${s.last_name}`,
        ev?.traits[1] ?? 3,
        ev?.traits[2] ?? 3,
        ev?.traits[3] ?? 3,
        ev?.traits[4] ?? 3,
        ev?.traits[5] ?? 3,
        ev?.traits[6] ?? 3,
        ev?.traits[7] ?? 3,
        ev?.traits[8] ?? 3,
        summaryLevel,
        LEVEL_LABELS[summaryLevel]?.short || 'ดีเยี่ยม',
      ]);
    });

    // Sheet 2: การอ่าน คิดวิเคราะห์ และเขียน
    const ws2 = workbook.addWorksheet('อ่าน คิดวิเคราะห์ เขียน');
    ws2.pageSetup = { orientation: 'landscape', paperSize: 9 };

    ws2.addRow([`แบบประเมินการอ่าน คิดวิเคราะห์ และเขียน ตามหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พ.ศ. 2551`]);
    ws2.addRow([`ชั้น ${classroomName}  ปีการศึกษา ${academicYear}  ${term === 'yearly' ? 'ตลอดปีการศึกษา' : `ภาคเรียนที่ ${term}`}`]);
    ws2.addRow([]);

    const headers2 = [
      'เลขที่',
      'รหัสนักเรียน',
      'ชื่อ - นามสกุล',
      '1. การอ่าน',
      '2. จับใจความ',
      '3. คิดวิเคราะห์',
      '4. แสดงความคิดเห็น',
      '5. เขียนสื่อความ',
      'สรุปผลการประเมิน',
      'ระดับคุณภาพ',
    ];
    ws2.addRow(headers2);

    students.forEach((s, idx) => {
      const ev = evaluations[s.id];
      const summaryLevel = ev?.reading_summary ?? 3;
      ws2.addRow([
        idx + 1,
        s.student_code || '-',
        `${s.first_name} ${s.last_name}`,
        ev?.reading[1] ?? 3,
        ev?.reading[2] ?? 3,
        ev?.reading[3] ?? 3,
        ev?.reading[4] ?? 3,
        ev?.reading[5] ?? 3,
        summaryLevel,
        LEVEL_LABELS[summaryLevel]?.short || 'ดีเยี่ยม',
      ]);
    });

    // Style Header rows
    [ws1, ws2].forEach((ws) => {
      ws.getRow(1).font = { bold: true, size: 14, color: { argb: 'FF1E293B' } };
      ws.getRow(2).font = { bold: true, size: 11, color: { argb: 'FF475569' } };
      ws.getRow(4).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      ws.getRow(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
      ws.getRow(4).alignment = { vertical: 'middle', horizontal: 'center' };

      // Auto fit columns
      ws.columns.forEach((col) => {
        col.width = 16;
      });
      if (ws.columns[2]) ws.columns[2].width = 25; // Name column wider
    });

    const buffer = await workbook.xlsx.writeBuffer();
    downloadExcelBuffer(buffer as any, `ประเมินคุณลักษณะ_ปพ5_${classroomName}_ปี${academicYear}_เทอม${term}.xlsx`);
    showToast('ส่งออกไฟล์ Excel แบบ ปพ.5 สำเร็จ');
  };

  const currentClassroom = classrooms.find((c) => c.id === selectedClassroomId);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const query = searchQuery.trim().toLowerCase();
      const matchQuery =
        !query ||
        s.first_name.toLowerCase().includes(query) ||
        s.last_name.toLowerCase().includes(query) ||
        (s.nickname && s.nickname.toLowerCase().includes(query)) ||
        (s.student_code && s.student_code.toLowerCase().includes(query));

      if (!matchQuery) return false;

      const ev = evaluations[s.id];
      if (!ev) return true;

      if (filterMode === 'needs_attention') {
        const hasLowTrait = Object.values(ev.traits).some((v) => v <= 1) || ev.trait_summary <= 1;
        const hasLowReading = Object.values(ev.reading).some((v) => v <= 1) || ev.reading_summary <= 1;
        return hasLowTrait || hasLowReading;
      }
      if (filterMode === 'excellent') {
        return ev.trait_summary === 3 && ev.reading_summary === 3;
      }
      return true;
    });
  }, [students, evaluations, searchQuery, filterMode]);

  // Statistics Calculation
  const stats = useMemo(() => {
    let count3 = 0;
    let count2 = 0;
    let count1 = 0;
    let count0 = 0;

    const total = students.length;
    students.forEach((s) => {
      const ev = evaluations[s.id];
      const sum = activeTab === 'reading' ? (ev?.reading_summary ?? 3) : (ev?.trait_summary ?? 3);
      if (sum === 3) count3++;
      else if (sum === 2) count2++;
      else if (sum === 1) count1++;
      else count0++;
    });

    return {
      total,
      count3,
      pct3: total > 0 ? Math.round((count3 / total) * 100) : 0,
      count2,
      pct2: total > 0 ? Math.round((count2 / total) * 100) : 0,
      count1,
      pct1: total > 0 ? Math.round((count1 / total) * 100) : 0,
      count0,
      pct0: total > 0 ? Math.round((count0 / total) * 100) : 0,
    };
  }, [students, evaluations, activeTab]);

  const hasDirtyRecords = useMemo(() => {
    return Object.values(evaluations).some((e) => e.isDirty);
  }, [evaluations]);

  return (
    <div className="space-y-6 pb-28">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] lg:bottom-6 right-4 sm:right-6 z-50 flex items-center gap-2 rounded-xl bg-[#1C342B] px-4 py-3 text-sm font-medium text-white shadow-2xl transition-all">
          <Sparkles className="h-4 w-4 text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* MORNING SAGE LINEN CONTAINER                             */}
      {/* ======================================================== */}
      <div className="rounded-[28px] border border-[#DCE3D7] bg-[#FAFBF8] p-4 sm:p-7 shadow-[0_2px_12px_rgba(28,52,43,0.05)]">
        
        {/* Header */}
        <header className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#E9F0EA] px-3 py-0.5 text-xs font-bold text-[#2F7D5B] border border-[#DCE3D7]">
                <Award size={13} className="text-[#2F7D5B]" />
                มาตรฐานหลักสูตรแกนกลาง สพฐ. 2551
              </span>
              {currentClassroom && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-0.5 text-xs font-bold text-[#1C342B] border border-[#DCE3D7]">
                  ชั้น {currentClassroom.name}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#1C342B] tracking-tight flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#E9F0EA] text-[#2F7D5B] border border-[#DCE3D7]">
                <Award size={20} aria-hidden="true" />
              </span>
              <span>คุณลักษณะอันพึงประสงค์ &amp; อ่านคิดเขียน</span>
            </h1>
            <p className="mt-1 text-sm sm:text-base font-semibold text-[#5A6F64]">
              บันทึกผลการประเมิน 8 คุณลักษณะ และทักษะการอ่าน คิดวิเคราะห์ เขียน สำหรับทำแบบ ปพ.5 และ ปพ.6
            </p>
          </div>

          {/* 4 Stat Summary Cards */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:min-w-[480px]">
            {/* Level 3: ดีเยี่ยม */}
            <div className="relative rounded-xl border border-[#DCE3D7] border-t-[3px] border-t-[#2F7D5B] bg-white p-3 text-center shadow-2xs transition hover:-translate-y-0.5">
              <p className="text-lg sm:text-xl font-black text-[#1C342B]">{stats.count3} <span className="text-xs font-semibold text-[#5A6F64]">คน</span></p>
              <p className="mt-0.5 text-xs font-bold text-[#2F7D5B]">ดีเยี่ยม (3) · {stats.pct3}%</p>
            </div>

            {/* Level 2: ดี */}
            <div className="relative rounded-xl border border-[#DCE3D7] border-t-[3px] border-t-[#2D72A3] bg-white p-3 text-center shadow-2xs transition hover:-translate-y-0.5">
              <p className="text-lg sm:text-xl font-black text-[#1C342B]">{stats.count2} <span className="text-xs font-semibold text-[#5A6F64]">คน</span></p>
              <p className="mt-0.5 text-xs font-bold text-[#2D72A3]">ดี (2) · {stats.pct2}%</p>
            </div>

            {/* Level 1: ผ่าน */}
            <div className="relative rounded-xl border border-[#DCE3D7] border-t-[3px] border-t-[#D98B26] bg-white p-3 text-center shadow-2xs transition hover:-translate-y-0.5">
              <p className="text-lg sm:text-xl font-black text-[#1C342B]">{stats.count1} <span className="text-xs font-semibold text-[#5A6F64]">คน</span></p>
              <p className="mt-0.5 text-xs font-bold text-[#B06C14]">ผ่าน (1) · {stats.pct1}%</p>
            </div>

            {/* Level 0: ไม่ผ่าน */}
            <div className="relative rounded-xl border border-[#DCE3D7] border-t-[3px] border-t-[#C25970] bg-white p-3 text-center shadow-2xs transition hover:-translate-y-0.5">
              <p className="text-lg sm:text-xl font-black text-[#1C342B]">{stats.count0} <span className="text-xs font-semibold text-[#5A6F64]">คน</span></p>
              <p className="mt-0.5 text-xs font-bold text-[#C25970]">ไม่ผ่าน (0) · {stats.pct0}%</p>
            </div>
          </div>
        </header>

        {/* Filter / Selector Bar */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#DCE3D7] pt-3.5">
          {/* View Mode Toggle */}
          <div className="inline-flex rounded-2xl bg-white p-1 border border-[#DCE3D7] shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('board')}
              className={`flex items-center gap-1.5 rounded-xl px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold transition active:scale-95 ${
                viewMode === 'board'
                  ? 'bg-[#1C342B] text-white shadow-xs'
                  : 'text-[#5A6F64] hover:text-[#1C342B]'
              }`}
            >
              <LayoutGrid size={15} />
              <span>บอร์ดประเมินด่วน</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 rounded-xl px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold transition active:scale-95 ${
                viewMode === 'table'
                  ? 'bg-[#1C342B] text-white shadow-xs'
                  : 'text-[#5A6F64] hover:text-[#1C342B]'
              }`}
            >
              <ListFilter size={15} />
              <span>ตาราง ปพ.5 ละเอียด</span>
            </button>
          </div>

          {/* Selectors: Room, Year, Term */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative inline-flex items-center rotate-[0.8deg] shadow-xs">
              <select
                value={selectedClassroomId}
                onChange={(e) => setSelectedClassroomId(e.target.value)}
                className="appearance-none rounded-xl border border-[#c7bca9] bg-white py-1.5 pl-3 pr-7 text-xs sm:text-sm font-bold text-[#1c1917] shadow-xs focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
              >
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.academic_year ? `(${c.academic_year})` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#57534e]" />
            </div>

            <div className="relative inline-flex items-center shadow-xs">
              <select
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="appearance-none rounded-xl border border-[#c7bca9] bg-white py-1.5 pl-3 pr-7 text-xs sm:text-sm font-bold text-[#1c1917] shadow-xs focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
              >
                <option value="2569">ปี 2569</option>
                <option value="2568">ปี 2568</option>
                <option value="2567">ปี 2567</option>
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#57534e]" />
            </div>

            <div className="relative inline-flex items-center shadow-xs">
              <select
                value={term}
                onChange={(e) => setTerm(e.target.value as any)}
                className="appearance-none rounded-xl border border-[#c7bca9] bg-white py-1.5 pl-3 pr-7 text-xs sm:text-sm font-bold text-[#1c1917] shadow-xs focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
              >
                <option value="1">ภาคเรียนที่ 1</option>
                <option value="2">ภาคเรียนที่ 2</option>
                <option value="yearly">สรุปทั้งปี</option>
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#57534e]" />
            </div>
          </div>
        </div>

        {/* Section Tabs (8 คุณลักษณะ / อ่านคิดเขียน / ภาพรวม) */}
        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-b border-[#e2d5c3] pb-3">
          <div className="inline-flex rounded-xl bg-white/70 p-1 border border-[#c7bca9]">
            <button
              onClick={() => {
                setActiveTab('traits');
                setSelectedIndicatorId('summary');
              }}
              type="button"
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-bold transition ${
                activeTab === 'traits' ? 'bg-[#332f2b] text-white shadow-xs' : 'text-[#57534e] hover:text-[#1c1917]'
              }`}
            >
              <Award size={14} />
              <span>คุณลักษณะ 8 ประการ</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('reading');
                setSelectedIndicatorId('summary');
              }}
              type="button"
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-bold transition ${
                activeTab === 'reading' ? 'bg-[#332f2b] text-white shadow-xs' : 'text-[#57534e] hover:text-[#1c1917]'
              }`}
            >
              <BookOpen size={14} />
              <span>การอ่าน คิดวิเคราะห์ เขียน</span>
            </button>
            <button
              onClick={() => setActiveTab('overview')}
              type="button"
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-bold transition ${
                activeTab === 'overview' ? 'bg-[#332f2b] text-white shadow-xs' : 'text-[#57534e] hover:text-[#1c1917]'
              }`}
            >
              <GraduationCap size={14} />
              <span>สรุปผลรวม ปพ.5</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={setAllToExcellent}
              type="button"
              className="inline-flex items-center gap-1 rounded-xl bg-[#2F7D5B] hover:bg-[#256549] px-3 py-1.5 text-xs font-bold text-white shadow-2xs active:scale-95 transition"
            >
              <Sparkles size={13} />
              <span>ดีเยี่ยม (3) ทุกคน</span>
            </button>
            <button
              onClick={handleExportExcel}
              type="button"
              className="inline-flex items-center gap-1 rounded-xl border border-[#DCE3D7] bg-white px-3 py-1.5 text-xs font-bold text-[#1C342B] hover:bg-[#E9F0EA]/60 active:scale-95 transition shadow-2xs"
            >
              <Download size={13} />
              <span>Excel ปพ.5</span>
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* POST-IT BOARD MODE                                       */}
        {/* ======================================================== */}
        {viewMode === 'board' && activeTab !== 'overview' && (
          <div className="mt-4">
            {/* Indicator Pills Toolbar */}
            <div className="flex flex-wrap items-center gap-1.5 pb-2">
              <span className="text-xs font-bold text-[#5A6F64]">เลือกประเมินข้อ:</span>
              <button
                type="button"
                onClick={() => setSelectedIndicatorId('summary')}
                className={`inline-flex h-7.5 items-center gap-1 px-2.5 rounded-lg text-xs font-bold transition active:scale-95 ${
                  selectedIndicatorId === 'summary'
                    ? 'bg-[#1C342B] text-white ring-2 ring-[#2F7D5B]/40'
                    : 'bg-white border border-[#DCE3D7] text-[#1C342B] hover:bg-[#E9F0EA]/60'
                }`}
              >
                <Star size={12} aria-hidden="true" />
                <span>สรุปภาพรวม</span>
              </button>

              {activeTab === 'traits' &&
                OBEC_TRAITS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedIndicatorId(t.id)}
                    className={`h-7.5 px-2.5 rounded-lg text-xs font-bold transition active:scale-95 ${
                      selectedIndicatorId === t.id
                        ? 'bg-[#1C342B] text-white ring-2 ring-[#2F7D5B]/40'
                        : 'bg-white border border-[#DCE3D7] text-[#1C342B] hover:bg-[#E9F0EA]/60'
                    }`}
                    title={t.description}
                  >
                    {t.shortName}
                  </button>
                ))}

              {activeTab === 'reading' &&
                READING_INDICATORS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedIndicatorId(r.id)}
                    className={`h-7.5 px-2.5 rounded-lg text-xs font-bold transition active:scale-95 ${
                      selectedIndicatorId === r.id
                        ? 'bg-[#1C342B] text-white ring-2 ring-[#2F7D5B]/40'
                        : 'bg-white border border-[#DCE3D7] text-[#1C342B] hover:bg-[#E9F0EA]/60'
                    }`}
                    title={r.description}
                  >
                    {r.shortName}
                  </button>
                ))}
            </div>

            <p className="mt-1 flex flex-wrap items-center gap-1 text-xs sm:text-sm font-medium text-[#5A6F64]">
              <span>แตะโน้ตเพื่อสลับระดับ (3 ดีเยี่ยม → 2 ดี → 1 ผ่าน → 0 ไม่ผ่าน) หรือกดไอคอน</span>
              <Pencil size={12} className="inline text-[#2F7D5B]" aria-hidden="true" />
              <span>เพื่อดู/ประเมินครบทุกข้อรายคน</span>
            </p>

            {/* Post-it Notes Grid */}
            <div className="mt-4 grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3 sm:gap-4.5 pt-2">
              {filteredStudents.map((student, idx) => {
                const rollNumber = idx + 1;
                const ev = evaluations[student.id];
                const rotation = NOTE_ROTATIONS[idx % NOTE_ROTATIONS.length];

                // Calculate level for active indicator
                let level: EvaluationLevel = 3;
                if (activeTab === 'reading') {
                  level = selectedIndicatorId === 'summary'
                    ? (ev?.reading_summary ?? 3)
                    : (ev?.reading[selectedIndicatorId] ?? 3);
                } else {
                  level = selectedIndicatorId === 'summary'
                    ? (ev?.trait_summary ?? 3)
                    : (ev?.traits[selectedIndicatorId] ?? 3);
                }

                // Pastel Color Scheme matching level
                const levelConfig = {
                  3: { bg: 'bg-[#d9f99d] text-[#1b3e04] shadow-[2px_4px_6px_rgba(27,62,4,0.18)]', badge: 'bg-[#1b3e04]', label: 'ดีเยี่ยม (3)' },
                  2: { bg: 'bg-[#bae6fd] text-[#034f77] shadow-[2px_4px_6px_rgba(3,79,119,0.18)]', badge: 'bg-[#034f77]', label: 'ดี (2)' },
                  1: { bg: 'bg-[#fef08a] text-[#713f12] shadow-[2px_4px_6px_rgba(113,63,18,0.18)]', badge: 'bg-[#713f12]', label: 'ผ่าน (1)' },
                  0: { bg: 'bg-[#fecdd3] text-[#881337] shadow-[2px_4px_6px_rgba(136,19,55,0.18)]', badge: 'bg-[#881337]', label: 'ไม่ผ่าน (0)' },
                }[level];

                return (
                  <div
                    key={student.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleNoteCycle(student.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleNoteCycle(student.id);
                      }
                    }}
                    className={`group relative flex flex-col items-center justify-center rounded-xs sm:rounded-sm p-2 sm:p-2.5 min-h-[74px] sm:min-h-[82px] transition-all select-none active:scale-95 cursor-pointer ${levelConfig.bg} ${rotation} hover:scale-105 hover:z-10`}
                    title={`เลขที่ ${rollNumber}. ${student.first_name} ${student.last_name} (${levelConfig.label}) — แตะเพื่อเปลี่ยนระดับ`}
                  >
                    {/* Frosted Tape */}
                    <span className="pointer-events-none absolute -top-1.5 left-1/2 -translate-x-1/2 h-2.5 w-7 rounded-[1px] bg-white/70 shadow-2xs backdrop-blur-2xs" />

                    {/* Pencil Edit Icon Button */}
                    <button
                      type="button"
                      aria-label={`แก้ไขรายละเอียดของ ${student.first_name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSheetStudent(student);
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

                    {/* Badge: Level */}
                    <div className="mt-1">
                      <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.2 text-[10px] sm:text-xs font-bold text-white shadow-2xs ${levelConfig.badge}`}>
                        {levelConfig.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Empty State */}
            {filteredStudents.length === 0 && !isLoading && (
              <div className="mt-8 rounded-3xl border border-amber-200 bg-amber-50/80 p-8 text-center text-amber-950">
                <p className="text-base font-bold">ไม่พบนักเรียนตามเงื่อนไขที่เลือก</p>
                <p className="mt-1 text-xs text-amber-800/80">ลองเปลี่ยนห้องเรียนหรือคำค้นหา</p>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* DETAILED TABLE MODE & OVERVIEW                           */}
        {/* ======================================================== */}
        {(viewMode === 'table' || activeTab === 'overview') && (
          <div className="mt-6 rounded-2xl border border-[#ded5c6] bg-white/95 shadow-sm overflow-hidden">
            <div className="border-b border-[#f0e8dc] bg-amber-50/30 px-4 py-3 sm:px-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#3f3a36] uppercase tracking-wider">
                  {activeTab === 'traits'
                    ? 'ตารางประเมินคุณลักษณะอันพึงประสงค์ 8 ประการ'
                    : activeTab === 'reading'
                    ? 'ตารางประเมินการอ่าน คิดวิเคราะห์ และเขียน'
                    : 'ตารางสรุปผลรวมทั้งสองด้าน'}
                </span>
                <span className="text-xs text-[#8a8178]">({filteredStudents.length} คน)</span>
              </div>

              <div className="flex items-center gap-3 text-xs font-bold text-[#78716c]">
                <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-lime-500" /> 3 = ดีเยี่ยม</span>
                <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-sky-500" /> 2 = ดี</span>
                <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> 1 = ผ่าน</span>
                <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> 0 = ไม่ผ่าน</span>
              </div>
            </div>

        {/* Table Container */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <RefreshCw className="h-8 w-8 animate-spin text-indigo-500 mb-3" />
              <p className="text-sm">กำลังโหลดรายชื่อและผลการประเมิน...</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Users className="mx-auto h-10 w-10 text-slate-300 mb-2" />
              <p className="text-sm font-medium">ไม่พบข้อมูลนักเรียนในเงื่อนไขที่เลือก</p>
            </div>
          ) : activeTab === 'traits' ? (
            /* TAB 1: 8 คุณลักษณะ */
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-700 font-semibold">
                  <th className="py-3 px-3 w-12 text-center">ที่</th>
                  <th className="py-3 px-4 min-w-[160px]">ชื่อ - นามสกุล</th>
                  {OBEC_TRAITS.map((t) => (
                    <th key={t.id} className="py-3 px-2 text-center min-w-[85px] border-l border-slate-200">
                      <div className="group relative inline-block cursor-help">
                        <span className="block">{t.shortName}</span>
                        {/* Hover Tooltip */}
                        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden w-48 rounded-lg bg-slate-900 p-2 text-center text-[11px] font-normal text-white shadow-xl group-hover:block z-20">
                          <p className="font-bold">{t.name}</p>
                          <p className="mt-1 text-slate-300">{t.description}</p>
                        </div>
                      </div>
                      {/* Column Bulk Action Dropdown */}
                      <div className="mt-1">
                        <select
                          title="ตั้งทั้งคอลัมน์"
                          onChange={(e) => {
                            if (e.target.value !== '') {
                              setColumnToLevel('traits', t.id, Number(e.target.value) as EvaluationLevel);
                              e.target.value = '';
                            }
                          }}
                          defaultValue=""
                          className="text-[10px] rounded border border-slate-300 bg-white px-1 py-0.5 text-slate-600 font-normal focus:outline-none"
                        >
                          <option value="" disabled>ตั้งคอลัมน์</option>
                          <option value="3">ทุกแถว 3</option>
                          <option value="2">ทุกแถว 2</option>
                          <option value="1">ทุกแถว 1</option>
                          <option value="0">ทุกแถว 0</option>
                        </select>
                      </div>
                    </th>
                  ))}
                  <th className="py-3 px-3 text-center min-w-[100px] border-l-2 border-indigo-200 bg-indigo-50/50 text-indigo-950 font-bold">
                    สรุปผล 8 ข้อ
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((s, idx) => {
                  const ev = evaluations[s.id] || {
                    student_id: s.id,
                    traits: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3 },
                    trait_summary: 3,
                    reading: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3 },
                    reading_summary: 3,
                    note: '',
                  };
                  const summaryLevel = ev.trait_summary;

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-xs">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-800">
                        <div className="flex items-center gap-1.5">
                          <span>{s.first_name} {s.last_name}</span>
                          {s.nickname && <span className="text-xs text-slate-400">({s.nickname})</span>}
                        </div>
                        {s.student_code && (
                          <div className="text-[11px] text-slate-400 font-mono">รหัส {s.student_code}</div>
                        )}
                      </td>

                      {/* 8 Traits Cells */}
                      {OBEC_TRAITS.map((t) => {
                        const currentVal = (ev.traits[t.id] ?? 3) as EvaluationLevel;
                        return (
                          <td key={t.id} className="py-2 px-1 text-center border-l border-slate-100">
                            <div className="inline-flex rounded-lg p-0.5 bg-slate-100/80 gap-0.5">
                              {([3, 2, 1, 0] as EvaluationLevel[]).map((lvl) => {
                                const isSelected = currentVal === lvl;
                                return (
                                  <button
                                    key={lvl}
                                    type="button"
                                    onClick={() => updateTrait(s.id, t.id, lvl)}
                                    title={`${t.shortName}: ${LEVEL_LABELS[lvl].label}`}
                                    className={`h-7 w-7 rounded-md text-xs font-bold transition-all ${
                                      isSelected
                                        ? `${LEVEL_LABELS[lvl].bg} text-white shadow-sm scale-105`
                                        : 'text-slate-500 hover:text-slate-900 hover:bg-white'
                                    }`}
                                  >
                                    {lvl}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                        );
                      })}

                      {/* Summary Cell */}
                      <td className="py-2 px-2 text-center border-l-2 border-indigo-200 bg-indigo-50/20">
                        <div className="flex items-center justify-center gap-1">
                          <select
                            value={summaryLevel}
                            onChange={(e) => updateSummaryOverride(s.id, 'traits', Number(e.target.value) as EvaluationLevel)}
                            className={`rounded-lg px-2 py-1 text-xs font-bold border focus:outline-none ${
                              summaryLevel === 3
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : summaryLevel === 2
                                ? 'bg-sky-100 text-sky-800 border-sky-300'
                                : summaryLevel === 1
                                ? 'bg-amber-100 text-amber-800 border-amber-300'
                                : 'bg-rose-100 text-rose-800 border-rose-300'
                            }`}
                          >
                            <option value="3">3 - ดีเยี่ยม</option>
                            <option value="2">2 - ดี</option>
                            <option value="1">1 - ผ่าน</option>
                            <option value="0">0 - ไม่ผ่าน</option>
                          </select>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : activeTab === 'reading' ? (
            /* TAB 2: อ่าน คิดวิเคราะห์ และเขียน */
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-700 font-semibold">
                  <th className="py-3 px-3 w-12 text-center">ที่</th>
                  <th className="py-3 px-4 min-w-[160px]">ชื่อ - นามสกุล</th>
                  {READING_INDICATORS.map((ind) => (
                    <th key={ind.id} className="py-3 px-2 text-center min-w-[95px] border-l border-slate-200">
                      <div className="group relative inline-block cursor-help">
                        <span className="block">{ind.shortName}</span>
                        {/* Hover Tooltip */}
                        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden w-48 rounded-lg bg-slate-900 p-2 text-center text-[11px] font-normal text-white shadow-xl group-hover:block z-20">
                          <p className="font-bold">{ind.name}</p>
                          <p className="mt-1 text-slate-300">{ind.description}</p>
                        </div>
                      </div>
                      <div className="mt-1">
                        <select
                          title="ตั้งทั้งคอลัมน์"
                          onChange={(e) => {
                            if (e.target.value !== '') {
                              setColumnToLevel('reading', ind.id, Number(e.target.value) as EvaluationLevel);
                              e.target.value = '';
                            }
                          }}
                          defaultValue=""
                          className="text-[10px] rounded border border-slate-300 bg-white px-1 py-0.5 text-slate-600 font-normal focus:outline-none"
                        >
                          <option value="" disabled>ตั้งคอลัมน์</option>
                          <option value="3">ทุกแถว 3</option>
                          <option value="2">ทุกแถว 2</option>
                          <option value="1">ทุกแถว 1</option>
                          <option value="0">ทุกแถว 0</option>
                        </select>
                      </div>
                    </th>
                  ))}
                  <th className="py-3 px-3 text-center min-w-[100px] border-l-2 border-indigo-200 bg-indigo-50/50 text-indigo-950 font-bold">
                    สรุปผลการอ่านคิดเขียน
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((s, idx) => {
                  const ev = evaluations[s.id] || {
                    student_id: s.id,
                    traits: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3 },
                    trait_summary: 3,
                    reading: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3 },
                    reading_summary: 3,
                    note: '',
                  };
                  const summaryLevel = ev.reading_summary;

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-xs">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-800">
                        <div className="flex items-center gap-1.5">
                          <span>{s.first_name} {s.last_name}</span>
                          {s.nickname && <span className="text-xs text-slate-400">({s.nickname})</span>}
                        </div>
                        {s.student_code && (
                          <div className="text-[11px] text-slate-400 font-mono">รหัส {s.student_code}</div>
                        )}
                      </td>

                      {/* Reading Indicators Cells */}
                      {READING_INDICATORS.map((ind) => {
                        const currentVal = (ev.reading[ind.id] ?? 3) as EvaluationLevel;
                        return (
                          <td key={ind.id} className="py-2 px-1 text-center border-l border-slate-100">
                            <div className="inline-flex rounded-lg p-0.5 bg-slate-100/80 gap-0.5">
                              {([3, 2, 1, 0] as EvaluationLevel[]).map((lvl) => {
                                const isSelected = currentVal === lvl;
                                return (
                                  <button
                                    key={lvl}
                                    type="button"
                                    onClick={() => updateReading(s.id, ind.id, lvl)}
                                    title={`${ind.shortName}: ${LEVEL_LABELS[lvl].label}`}
                                    className={`h-7 w-7 rounded-md text-xs font-bold transition-all ${
                                      isSelected
                                        ? `${LEVEL_LABELS[lvl].bg} text-white shadow-sm scale-105`
                                        : 'text-slate-500 hover:text-slate-900 hover:bg-white'
                                    }`}
                                  >
                                    {lvl}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                        );
                      })}

                      {/* Reading Summary Cell */}
                      <td className="py-2 px-2 text-center border-l-2 border-indigo-200 bg-indigo-50/20">
                        <div className="flex items-center justify-center gap-1">
                          <select
                            value={summaryLevel}
                            onChange={(e) => updateSummaryOverride(s.id, 'reading', Number(e.target.value) as EvaluationLevel)}
                            className={`rounded-lg px-2 py-1 text-xs font-bold border focus:outline-none ${
                              summaryLevel === 3
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : summaryLevel === 2
                                ? 'bg-sky-100 text-sky-800 border-sky-300'
                                : summaryLevel === 1
                                ? 'bg-amber-100 text-amber-800 border-amber-300'
                                : 'bg-rose-100 text-rose-800 border-rose-300'
                            }`}
                          >
                            <option value="3">3 - ดีเยี่ยม</option>
                            <option value="2">2 - ดี</option>
                            <option value="1">1 - ผ่าน</option>
                            <option value="0">0 - ไม่ผ่าน</option>
                          </select>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            /* TAB 3: มุมมองสรุปผลรวม (ปพ.5) */
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-700 font-semibold">
                  <th className="py-3 px-3 w-12 text-center">ที่</th>
                  <th className="py-3 px-4 min-w-[160px]">ชื่อ - นามสกุล</th>
                  <th className="py-3 px-4 text-center min-w-[140px] border-l border-slate-200">
                    คุณลักษณะอันพึงประสงค์ 8 ประการ
                  </th>
                  <th className="py-3 px-4 text-center min-w-[140px] border-l border-slate-200">
                    การอ่าน คิดวิเคราะห์ และเขียน
                  </th>
                  <th className="py-3 px-4 text-center min-w-[120px] border-l border-slate-200">
                    สรุปผลรวม ปพ.5
                  </th>
                  <th className="py-3 px-4 text-left min-w-[180px] border-l border-slate-200">
                    บันทึกข้อเสนอแนะ / จุดเด่น
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((s, idx) => {
                  const ev = evaluations[s.id];
                  const traitSum = ev?.trait_summary ?? 3;
                  const readingSum = ev?.reading_summary ?? 3;
                  const combinedPass = traitSum >= 1 && readingSum >= 1;

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 text-center text-slate-400 font-mono text-xs">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">
                        <div>{s.first_name} {s.last_name}</div>
                        {s.student_code && <div className="text-[11px] text-slate-400 font-mono">รหัส {s.student_code}</div>}
                      </td>

                      <td className="py-3 px-4 text-center border-l border-slate-100">
                        <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${
                          traitSum === 3 ? 'bg-emerald-100 text-emerald-800' :
                          traitSum === 2 ? 'bg-sky-100 text-sky-800' :
                          traitSum === 1 ? 'bg-amber-100 text-amber-800' :
                          'bg-rose-100 text-rose-800'
                        }`}>
                          {LEVEL_LABELS[traitSum].label}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center border-l border-slate-100">
                        <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${
                          readingSum === 3 ? 'bg-emerald-100 text-emerald-800' :
                          readingSum === 2 ? 'bg-sky-100 text-sky-800' :
                          readingSum === 1 ? 'bg-amber-100 text-amber-800' :
                          'bg-rose-100 text-rose-800'
                        }`}>
                          {LEVEL_LABELS[readingSum].label}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center border-l border-slate-100 font-semibold">
                        {combinedPass ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md">
                            <CheckCircle2 className="h-3.5 w-3.5" /> ผ่านเกณฑ์ ปพ.
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 px-2.5 py-1 rounded-md">
                            <AlertCircle className="h-3.5 w-3.5" /> ไม่ผ่านเกณฑ์
                          </span>
                        )}
                      </td>

                      <td className="py-2 px-4 border-l border-slate-100">
                        <input
                          type="text"
                          placeholder="เพิ่มข้อสังเกต หรือจุดที่ควรส่งเสริม..."
                          value={ev?.note || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEvaluations((prev) => ({
                              ...prev,
                              [s.id]: {
                                ...(prev[s.id] || {
                                  student_id: s.id,
                                  traits: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3 },
                                  trait_summary: 3,
                                  reading: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3 },
                                  reading_summary: 3,
                                }),
                                note: val,
                                isDirty: true,
                              },
                            }));
                          }}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 focus:bg-white focus:border-indigo-400 focus:outline-none"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer save status */}
        <div className="border-t border-[#DCE3D7] bg-[#F6F7F3] p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#5A6F64]">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-[#2F7D5B]" />
            <span>เกณฑ์การประเมินสอดคล้องกับระเบียบกระทรวงศึกษาธิการว่าด้วยการวัดและประเมินผลการเรียนรู้</span>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#1C342B] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#152821] active:scale-95 transition"
          >
            <Save className="h-4 w-4" />
            <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูลผลการประเมิน'}</span>
          </button>
        </div>
      </div>
      )}

      {/* Generous bottom spacer so page can scroll comfortably past bottom dock */}
      <div className="h-32 sm:h-20 lg:h-10" aria-hidden="true" />
      </div>

      {/* ======================================================== */}
      {/* FLOATING ACTION DOCK                                     */}
      {/* ======================================================== */}
      {viewMode === 'board' && filteredStudents.length > 0 && (
        <div className="fixed inset-x-4 bottom-20 z-30 lg:sticky lg:bottom-4 lg:z-10 mx-auto max-w-sm sm:max-w-md rounded-2xl border border-[#DCE3D7] bg-[#FAFBF8]/95 p-3.5 shadow-xl backdrop-blur-md">
          {/* Summary Text */}
          <div className="flex items-center justify-center gap-3 sm:gap-4 text-xs sm:text-sm font-bold text-[#1C342B]">
            <span>
              ดีเยี่ยม <b className="text-[#2F7D5B]">{stats.count3}</b>
            </span>
            <span>
              ดี <b className="text-[#2D72A3]">{stats.count2}</b>
            </span>
            <span>
              ผ่าน <b className="text-[#B06C14]">{stats.count1}</b>
            </span>
            <span>
              ไม่ผ่าน <b className="text-[#881337]">{stats.count0}</b>
            </span>
          </div>

          {/* Primary Save Button */}
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1C342B] text-base font-bold text-white shadow-md hover:bg-[#152821] active:translate-y-0.5 transition-all disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? (
              <span>กำลังบันทึก...</span>
            ) : (
              <>
                <Check size={20} className="stroke-[3]" />
                <span>บันทึกผลประเมินเรียบร้อย</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* SINGLE STUDENT EVALUATION MODAL (Pencil Click)            */}
      {/* ======================================================== */}
      {sheetStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg rounded-3xl border border-[#DCE3D7] bg-[#FAFBF8] p-5 sm:p-6 shadow-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#DCE3D7] pb-3">
              <div>
                <h3 className="text-lg font-bold text-[#1C342B]">
                  {sheetStudent.first_name} {sheetStudent.last_name}
                </h3>
                <p className="text-xs text-[#5A6F64]">
                  {sheetStudent.nickname ? `น้อง${sheetStudent.nickname}` : 'นักเรียน'} · ประเมินผลครบทุกข้อ
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSheetStudent(null)}
                className="rounded-xl p-1.5 text-[#5A6F64] hover:bg-[#E9F0EA]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-3">
              {activeTab === 'reading' ? (
                /* 5 Reading Items */
                READING_INDICATORS.map((r) => {
                  const ev = evaluations[sheetStudent.id];
                  const currentLevel = ev?.reading[r.id] ?? 3;
                  return (
                    <div key={r.id} className="p-3 rounded-2xl bg-white border border-[#ded5c6]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-[#3f3a36]">{r.name}</span>
                        <span className="text-xs text-[#8a8178]">({LEVEL_LABELS[currentLevel].short})</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {([3, 2, 1, 0] as EvaluationLevel[]).map((lvl) => (
                          <button
                            key={lvl}
                            type="button"
                            onClick={() => updateReading(sheetStudent.id, r.id, lvl)}
                            className={`h-8 rounded-xl text-xs font-bold transition ${
                              currentLevel === lvl
                                ? `${LEVEL_LABELS[lvl].bg} text-white shadow-xs ring-2 ring-amber-400`
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {LEVEL_LABELS[lvl].label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })
              ) : (
                /* 8 Traits Items */
                OBEC_TRAITS.map((t) => {
                  const ev = evaluations[sheetStudent.id];
                  const currentLevel = ev?.traits[t.id] ?? 3;
                  return (
                    <div key={t.id} className="p-3 rounded-2xl bg-white border border-[#ded5c6]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-[#3f3a36]">{t.name}</span>
                        <span className="text-xs text-[#8a8178]">({LEVEL_LABELS[currentLevel].short})</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {([3, 2, 1, 0] as EvaluationLevel[]).map((lvl) => (
                          <button
                            key={lvl}
                            type="button"
                            onClick={() => updateTrait(sheetStudent.id, t.id, lvl)}
                            className={`h-8 rounded-xl text-xs font-bold transition ${
                              currentLevel === lvl
                                ? `${LEVEL_LABELS[lvl].bg} text-white shadow-xs ring-2 ring-amber-400`
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {LEVEL_LABELS[lvl].label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}

              {/* Note field */}
              <div className="p-3 rounded-2xl bg-white border border-[#ded5c6]">
                <label className="text-xs font-bold text-[#78716c] block mb-1">หมายเหตุ / จุดที่ควรส่งเสริม:</label>
                <input
                  type="text"
                  placeholder="เช่น มีพัฒนาการดีขึ้น, ควรส่งเสริมด้านความรับผิดชอบ"
                  value={evaluations[sheetStudent.id]?.note || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEvaluations((prev) => ({
                      ...prev,
                      [sheetStudent.id]: {
                        ...(prev[sheetStudent.id] || {
                          student_id: sheetStudent.id,
                          traits: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3 },
                          trait_summary: 3,
                          reading: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3 },
                          reading_summary: 3,
                        }),
                        note: val,
                        isDirty: true,
                      },
                    }));
                  }}
                  className="h-9 w-full rounded-xl border border-[#ded5c6] bg-amber-50/30 px-3 text-xs font-bold text-[#3f3a36] outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>

            <div className="border-t border-[#f0e8dc] pt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setSheetStudent(null)}
                className="h-10 px-5 rounded-xl bg-[#332f2b] text-white text-xs font-bold shadow-xs hover:bg-[#252220] transition active:scale-95"
              >
                เรียบร้อย ✓
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
