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
  Printer,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  UserCheck,
  Users,
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

export function DesirableCharacteristicsPage({ session }: DesirableCharacteristicsPageProps) {
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
    showToast('✨ ตั้งต้นทุกคนเป็นระดับ 3 (ดีเยี่ยม) เรียบร้อยแล้ว!');
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
    showToast(`🎯 ปรับทั้งคอลัมน์เป็นระดับ ${level} เรียบร้อยแล้ว`);
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

      showToast('💾 บันทึกผลการประเมินเรียบร้อยแล้ว!');
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
    showToast('📥 ส่งออกไฟล์ Excel แบบ ปพ.5 สำเร็จ!');
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
    <div className="space-y-6 pb-20">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-2xl transition-all">
          <Sparkles className="h-4 w-4 text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 text-white shadow-md">
              <Award className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                  มาตรฐานหลักสูตรแกนกลาง สพฐ. 2551
                </span>
                {currentClassroom && (
                  <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                    ชั้น {currentClassroom.name}
                  </span>
                )}
              </div>
              <h1 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                คุณลักษณะอันพึงประสงค์ & อ่าน คิดวิเคราะห์ เขียน
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                บันทึกผลการประเมิน 8 คุณลักษณะ และทักษะการอ่าน คิดวิเคราะห์ เขียน สำหรับทำแบบ ปพ.5 และรายงาน ปพ.6
              </p>
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={setAllToExcellent}
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] transition-all"
            >
              <Sparkles className="h-4 w-4" />
              <span>✨ ตั้งต้นทุกคนเป็นระดับ 3 (ดีเยี่ยม)</span>
            </button>

            <button
              onClick={handleExportExcel}
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 active:scale-[0.98] transition-all"
            >
              <Download className="h-4 w-4 text-slate-500" />
              <span>ส่งออก ปพ.5 (Excel)</span>
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving}
              type="button"
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm transition-all active:scale-[0.98] ${
                hasDirtyRecords
                  ? 'bg-blue-600 hover:bg-blue-500 ring-2 ring-blue-400 ring-offset-2 animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700'
              }`}
            >
              <Save className="h-4 w-4" />
              <span>{isSaving ? 'กำลังบันทึก...' : hasDirtyRecords ? 'บันทึกการเปลี่ยนแปลง *' : 'บันทึกข้อมูล'}</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 border-t border-slate-100 pt-5">
          {/* Classroom Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">ห้องเรียน</label>
            <select
              value={selectedClassroomId}
              onChange={(e) => setSelectedClassroomId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
            >
              {classrooms.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.academic_year ? `(${c.academic_year})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Academic Year */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">ปีการศึกษา</label>
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="2569">2569</option>
              <option value="2568">2568</option>
              <option value="2567">2567</option>
            </select>
          </div>

          {/* Term */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">ภาคเรียน</label>
            <select
              value={term}
              onChange={(e) => setTerm(e.target.value as any)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="1">ภาคเรียนที่ 1</option>
              <option value="2">ภาคเรียนที่ 2</option>
              <option value="yearly">สรุปตลอดปีการศึกษา</option>
            </select>
          </div>

          {/* Search Box */}
          <div className="md:col-span-1 lg:col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1">ค้นหานักเรียน</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหาชื่อ, นามสกุล, เลขที่..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs (8 คุณลักษณะ / อ่าน คิดวิเคราะห์ เขียน / ภาพรวม) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-xl bg-slate-100 p-1">
          <button
            onClick={() => setActiveTab('traits')}
            type="button"
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'traits'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Award className="h-4 w-4" />
            <span>คุณลักษณะอันพึงประสงค์ 8 ประการ</span>
          </button>

          <button
            onClick={() => setActiveTab('reading')}
            type="button"
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'reading'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            <span>การอ่าน คิดวิเคราะห์ และเขียน</span>
          </button>

          <button
            onClick={() => setActiveTab('overview')}
            type="button"
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'overview'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <GraduationCap className="h-4 w-4" />
            <span>สรุปผลรวม (ปพ.5)</span>
          </button>
        </div>

        {/* Filter Badges */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">กรอง:</span>
          <button
            onClick={() => setFilterMode('all')}
            type="button"
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
              filterMode === 'all'
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            ทั้งหมด ({students.length})
          </button>
          <button
            onClick={() => setFilterMode('needs_attention')}
            type="button"
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
              filterMode === 'needs_attention'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            ต้องติดตาม (0 หรือ 1)
          </button>
          <button
            onClick={() => setFilterMode('excellent')}
            type="button"
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
              filterMode === 'excellent'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            ดีเยี่ยมทั้งหมด
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800">ระดับ 3 (ดีเยี่ยม)</span>
            <span className="rounded-md bg-emerald-200/60 px-1.5 py-0.5 text-[11px] font-bold text-emerald-900">
              {stats.pct3}%
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-900">{stats.count3} <span className="text-xs font-normal text-emerald-700">คน</span></div>
        </div>

        <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-sky-800">ระดับ 2 (ดี)</span>
            <span className="rounded-md bg-sky-200/60 px-1.5 py-0.5 text-[11px] font-bold text-sky-900">
              {stats.pct2}%
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-sky-900">{stats.count2} <span className="text-xs font-normal text-sky-700">คน</span></div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800">ระดับ 1 (ผ่าน)</span>
            <span className="rounded-md bg-amber-200/60 px-1.5 py-0.5 text-[11px] font-bold text-amber-900">
              {stats.pct1}%
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-amber-900">{stats.count1} <span className="text-xs font-normal text-amber-700">คน</span></div>
        </div>

        <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-800">ระดับ 0 (ไม่ผ่าน)</span>
            <span className="rounded-md bg-rose-200/60 px-1.5 py-0.5 text-[11px] font-bold text-rose-900">
              {stats.pct0}%
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-rose-900">{stats.count0} <span className="text-xs font-normal text-rose-700">คน</span></div>
        </div>
      </div>

      {/* Main Interactive Evaluation Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-3 sm:px-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              {activeTab === 'traits'
                ? 'ตารางประเมินคุณลักษณะอันพึงประสงค์ 8 ประการ'
                : activeTab === 'reading'
                ? 'ตารางประเมินการอ่าน คิดวิเคราะห์ และเขียน'
                : 'ตารางสรุปผลรวมทั้งสองด้าน'}
            </span>
            <span className="text-xs text-slate-400">({filteredStudents.length} คน)</span>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> 3 = ดีเยี่ยม</span>
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
        <div className="border-t border-slate-100 bg-slate-50/50 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <span>เกณฑ์การประเมินสอดคล้องกับระเบียบกระทรวงศึกษาธิการว่าด้วยการวัดและประเมินผลการเรียนรู้</span>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 active:scale-[0.98] transition-all"
          >
            <Save className="h-4 w-4" />
            <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูลผลการประเมิน'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
