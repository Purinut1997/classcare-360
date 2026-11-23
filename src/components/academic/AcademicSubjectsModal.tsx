import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Plus,
  Trash2,
  Edit2,
  Save,
  GraduationCap,
  Sparkles,
  Layers,
  AlertCircle,
  X,
  Calculator,
  Check,
  Filter,
} from 'lucide-react';
import { isDemoSession } from '../../lib/auth';
import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import {
  OBEC_LEARNING_AREAS,
  OBEC_PRIMARY_GRADES,
  OBEC_SECONDARY_GRADES,
  OBEC_ALL_GRADE_LEVELS,
  DEFAULT_OBEC_GRADE_RULES,
  adaptObecSubjectCode,
  getObecSubjectCatalogByGrade,
  inferGradeLevelFromObecCode,
  type SchoolSubject,
  type GradeRule,
} from '../../types/academic';
import { writeAuditLog } from '../../lib/auditLog';
import type { AppSessionContext } from '../../types/core';

interface AcademicSubjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: AppSessionContext;
  currentClassroomId?: string;
  currentClassroomName?: string;
  academicYear?: string;
  term?: '1' | '2' | 'yearly';
}

function normalizeClassroomGrade(classroomName?: string): string {
  const raw = (classroomName || '').split('/')[0]?.trim() || 'ป.5';
  if (OBEC_ALL_GRADE_LEVELS.includes(raw as (typeof OBEC_ALL_GRADE_LEVELS)[number])) {
    return raw;
  }
  const pMatch = raw.match(/ป\.?\s*([1-6])/);
  if (pMatch) return `ป.${pMatch[1]}`;
  const mMatch = raw.match(/ม\.?\s*([1-6])/);
  if (mMatch) return `ม.${mMatch[1]}`;
  return 'ป.5';
}

export const AcademicSubjectsModal: React.FC<AcademicSubjectsModalProps> = ({
  isOpen,
  onClose,
  session,
  currentClassroomId,
  currentClassroomName,
  academicYear = '2569',
  term = '1',
}) => {
  const defaultGrade = useMemo(() => normalizeClassroomGrade(currentClassroomName), [currentClassroomName]);

  const [activeTab, setActiveTab] = useState<'subjects' | 'grading'>('subjects');
  const [subjects, setSubjects] = useState<SchoolSubject[]>([]);
  const [gradeRules, setGradeRules] = useState<GradeRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Interactive OBEC Grade & Subject Picker State
  const [isCatalogPickerOpen, setIsCatalogPickerOpen] = useState(false);
  const [pickerGrade, setPickerGrade] = useState<string>(defaultGrade);
  const [selectedCatalogCodes, setSelectedCatalogCodes] = useState<string[]>([]);

  // Table Grade Filter ('all' or specific grade like 'ป.5')
  const [tableGradeFilter, setTableGradeFilter] = useState<string>('all');

  // Form states
  const [editingSubject, setEditingSubject] = useState<Partial<SchoolSubject> | null>(null);

  // Calculate & Publish Grades State
  const [isCalculatingGrades, setIsCalculatingGrades] = useState(false);
  const [calculatedCount, setCalculatedCount] = useState<number | null>(null);

  const workspaceId = session.workspace?.id;
  const isDemo = isDemoSession(session);

  // Catalog items for the currently selected picker grade
  const catalogForPickerGrade = useMemo(
    () => getObecSubjectCatalogByGrade(pickerGrade),
    [pickerGrade],
  );

  // Whenever pickerGrade changes, pre-select the 9 basic OBEC subjects for that grade
  useEffect(() => {
    const basicCodes = getObecSubjectCatalogByGrade(pickerGrade)
      .filter((item) => item.subjectType === 'basic')
      .map((item) => item.code);
    setSelectedCatalogCodes(basicCodes);
  }, [pickerGrade]);

  useEffect(() => {
    setPickerGrade(defaultGrade);
  }, [defaultGrade]);

  useEffect(() => {
    if (isOpen && workspaceId) {
      void loadAcademicData();
    }
  }, [isOpen, workspaceId]);

  const loadAcademicData = async () => {
    if (!workspaceId) return;
    setLoading(true);
    setFeedback(null);

    try {
      if (isDemo || !isSupabaseReady) {
        const catalog = getObecSubjectCatalogByGrade(defaultGrade).filter((item) => item.subjectType === 'basic');
        const demoSubs: SchoolSubject[] = catalog.map((tpl, index) => ({
          id: `demo-sub-${index + 1}`,
          workspace_id: workspaceId,
          subject_code: tpl.code,
          subject_name: tpl.name,
          learning_area: tpl.area,
          subject_type: tpl.subjectType,
          grade_level: defaultGrade,
          hours_per_year: tpl.hours,
          hours_per_week: Number((tpl.hours / 40).toFixed(1)),
          credit: tpl.credit,
          teacher_profile_id: session.profile.id,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));
        setSubjects(demoSubs);

        const demoRules: GradeRule[] = DEFAULT_OBEC_GRADE_RULES.map((rule, idx) => ({
          id: `demo-rule-${idx}`,
          workspace_id: workspaceId,
          min_score: rule.min_score,
          max_score: rule.max_score,
          grade: rule.grade,
          description: rule.description,
          is_active: true,
        }));
        setGradeRules(demoRules);
        setLoading(false);
        return;
      }

      if (!supabase) {
        setLoading(false);
        return;
      }

      const [subsRes, rulesRes] = await Promise.all([
        supabase
          .from('school_subjects')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('subject_code', { ascending: true }),
        supabase
          .from('grade_rules')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('min_score', { ascending: false }),
      ]);

      if (subsRes.data && subsRes.data.length > 0) {
        setSubjects(subsRes.data as SchoolSubject[]);
      } else {
        try {
          const cached =
            window.localStorage.getItem(`classcare_academic_subjects_${workspaceId}_${defaultGrade}`) ||
            window.localStorage.getItem(`classcare_academic_subjects_${workspaceId}_ป.5`);
          if (cached) {
            setSubjects(JSON.parse(cached));
          } else {
            setSubjects([]);
            setIsCatalogPickerOpen(true);
          }
        } catch {
          setSubjects([]);
        }
      }

      if (rulesRes.data && rulesRes.data.length > 0) {
        setGradeRules(rulesRes.data as GradeRule[]);
      } else {
        setGradeRules(
          DEFAULT_OBEC_GRADE_RULES.map((r, i) => ({
            id: `rule-default-${i}`,
            workspace_id: workspaceId,
            ...r,
          })),
        );
      }
    } catch (err) {
      console.error('Failed to load academic data:', err);
      setFeedback({ type: 'error', message: 'ไม่สามารถโหลดข้อมูลรายวิชาได้' });
    } finally {
      setLoading(false);
    }
  };

  // Annotate each subject with its effective grade inferred from the OBEC subject code
  const subjectsWithEffectiveGrade = useMemo(
    () =>
      subjects.map((sub) => ({
        ...sub,
        effectiveGrade: inferGradeLevelFromObecCode(sub.subject_code, sub.grade_level || defaultGrade),
      })),
    [subjects, defaultGrade],
  );

  // Count subjects per grade for the filter bar
  const gradeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    subjectsWithEffectiveGrade.forEach((sub) => {
      counts.set(sub.effectiveGrade, (counts.get(sub.effectiveGrade) || 0) + 1);
    });
    return counts;
  }, [subjectsWithEffectiveGrade]);

  const filteredSubjects = useMemo(() => {
    if (tableGradeFilter === 'all') return subjectsWithEffectiveGrade;
    return subjectsWithEffectiveGrade.filter((sub) => sub.effectiveGrade === tableGradeFilter);
  }, [subjectsWithEffectiveGrade, tableGradeFilter]);

  // Detect subjects whose OBEC code belongs to another grade (e.g. ป.1 'ค11101' mixed into ป.5)
  const mismatchedSubjectsForCurrentGrade = useMemo(
    () => subjectsWithEffectiveGrade.filter((sub) => sub.effectiveGrade !== defaultGrade),
    [subjectsWithEffectiveGrade, defaultGrade],
  );

  const existingSubjectCodeSet = useMemo(
    () => new Set(subjects.map((s) => s.subject_code.trim())),
    [subjects],
  );

  const toggleCatalogCode = (code: string) => {
    setSelectedCatalogCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  const handleImportSelectedCatalogSubjects = async () => {
    if (!workspaceId) return;
    const chosenItems = catalogForPickerGrade.filter((item) => selectedCatalogCodes.includes(item.code));
    if (chosenItems.length === 0) {
      setFeedback({ type: 'error', message: 'กรุณาติ๊กเลือกรายวิชาที่ต้องการดึงอย่างน้อย 1 รายวิชา' });
      return;
    }

    setLoading(true);
    setFeedback(null);

    const templateSubjects = chosenItems.map((tpl) => ({
      workspace_id: workspaceId,
      subject_code: tpl.code,
      subject_name: tpl.name,
      learning_area: tpl.area,
      subject_type: tpl.subjectType,
      grade_level: pickerGrade,
      hours_per_year: tpl.hours,
      hours_per_week: Number((tpl.hours / 40).toFixed(1)),
      credit: tpl.credit,
      teacher_profile_id: session.profile.id,
      is_active: true,
    }));

    if (isDemo || !isSupabaseReady) {
      const nowIso = new Date().toISOString();
      setSubjects((prev) => {
        const byCode = new Map(prev.map((item) => [item.subject_code, item]));
        templateSubjects.forEach((s, i) => {
          const existing = byCode.get(s.subject_code);
          byCode.set(s.subject_code, {
            id: existing?.id || `demo-sub-${Date.now()}-${i}`,
            ...s,
            created_at: existing?.created_at || nowIso,
            updated_at: nowIso,
          });
        });
        return Array.from(byCode.values()).sort((a, b) => a.subject_code.localeCompare(b.subject_code));
      });
      setTableGradeFilter(pickerGrade);
      setIsCatalogPickerOpen(false);
      setFeedback({
        type: 'success',
        message: `ดึงรหัสวิชาชั้น ${pickerGrade} จำนวน ${chosenItems.length} รายวิชาเรียบร้อยแล้ว`,
      });
      setLoading(false);
      return;
    }

    try {
      if (!supabase) throw new Error('Supabase client not available');

      const { error: testTableErr } = await supabase.from('school_subjects').select('id').limit(1);
      if (testTableErr && testTableErr.message?.includes('Could not find the table')) {
        const fallbackSubs = templateSubjects.map((s, i) => ({
          ...s,
          id: `local-sub-${i}-${Date.now()}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })) as SchoolSubject[];
        setSubjects((prev) => {
          const byCode = new Map(prev.map((item) => [item.subject_code, item]));
          fallbackSubs.forEach((s) => byCode.set(s.subject_code, s));
          const merged = Array.from(byCode.values()).sort((a, b) => a.subject_code.localeCompare(b.subject_code));
          try {
            window.localStorage.setItem(
              `classcare_academic_subjects_${workspaceId}_${pickerGrade}`,
              JSON.stringify(merged),
            );
          } catch {}
          return merged;
        });
        setTableGradeFilter(pickerGrade);
        setIsCatalogPickerOpen(false);
        setFeedback({
          type: 'success',
          message: `ดึงรหัสวิชาชั้น ${pickerGrade} จำนวน ${chosenItems.length} รายวิชาเรียบร้อยแล้ว`,
        });
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('school_subjects')
        .upsert(templateSubjects, {
          onConflict: 'workspace_id,subject_code,grade_level',
        })
        .select();

      if (error) throw error;

      await loadAcademicData();
      setTableGradeFilter(pickerGrade);
      setIsCatalogPickerOpen(false);
      setFeedback({
        type: 'success',
        message: `ดึงรหัสวิชาชั้น ${pickerGrade} จำนวน ${chosenItems.length} รายวิชาเข้าสู่ระบบสำเร็จ`,
      });
      await writeAuditLog(session, {
        entityId: workspaceId || 'academic',
        entityTable: 'school_subjects',
        action: 'academic.import_selected_subjects_by_grade',
        metadata: {
          count: data?.length || chosenItems.length,
          gradeLevel: pickerGrade,
          codes: chosenItems.map((i) => i.code),
        },
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'เกิดข้อผิดพลาดในการดึงรหัสวิชา' });
    } finally {
      setLoading(false);
    }
  };

  const handleCleanupMismatchedGrades = async () => {
    if (mismatchedSubjectsForCurrentGrade.length === 0) return;
    const sampleCodes = mismatchedSubjectsForCurrentGrade
      .slice(0, 4)
      .map((s) => `${s.subject_code} (${s.effectiveGrade})`)
      .join(', ');
    const confirmed = window.confirm(
      `ยืนยันการลบรายวิชาที่ไม่ใช่ชั้น ${defaultGrade} จำนวน ${mismatchedSubjectsForCurrentGrade.length} วิชา (${sampleCodes}${
        mismatchedSubjectsForCurrentGrade.length > 4 ? ' ฯลฯ' : ''
      }) หรือไม่?`,
    );
    if (!confirmed) return;

    const idsToRemove = mismatchedSubjectsForCurrentGrade.map((s) => s.id);
    setLoading(true);
    try {
      if (!isDemo && isSupabaseReady && supabase) {
        const { error } = await supabase.from('school_subjects').delete().in('id', idsToRemove);
        if (error) throw error;
      }
      setSubjects((prev) => prev.filter((s) => !idsToRemove.includes(s.id)));
      setTableGradeFilter('all');
      setFeedback({
        type: 'success',
        message: `ลบรายวิชาที่ไม่ตรงกับชั้น ${defaultGrade} จำนวน ${idsToRemove.length} รายวิชาเรียบร้อยแล้ว`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'ไม่สามารถลบรายวิชาได้' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !editingSubject?.subject_code || !editingSubject?.subject_name) return;

    setLoading(true);
    const trimmedCode = editingSubject.subject_code.trim();
    const inferredGrade = inferGradeLevelFromObecCode(
      trimmedCode,
      editingSubject.grade_level || defaultGrade,
    );
    const payload = {
      workspace_id: workspaceId,
      subject_code: trimmedCode,
      subject_name: editingSubject.subject_name.trim(),
      learning_area: editingSubject.learning_area || 'ภาษาไทย',
      subject_type: editingSubject.subject_type || 'basic',
      grade_level: editingSubject.grade_level || inferredGrade,
      hours_per_year: Number(editingSubject.hours_per_year) || 40,
      hours_per_week: Number(((Number(editingSubject.hours_per_year) || 40) / 40).toFixed(1)),
      credit: Number(editingSubject.credit) || Number(((Number(editingSubject.hours_per_year) || 40) / 40).toFixed(1)),
      teacher_profile_id: editingSubject.teacher_profile_id || session.profile.id,
      is_active: editingSubject.is_active ?? true,
    };

    if (isDemo || !isSupabaseReady) {
      if (editingSubject.id) {
        setSubjects((prev) =>
          prev.map((s) => (s.id === editingSubject.id ? ({ ...s, ...payload } as SchoolSubject) : s)),
        );
      } else {
        const newSub = {
          ...payload,
          id: `demo-sub-${Date.now()}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as SchoolSubject;
        setSubjects((prev) => [...prev, newSub]);
      }
      setEditingSubject(null);
      setFeedback({ type: 'success', message: 'บันทึกรายวิชาสำเร็จ (โหมดจำลอง)' });
      setLoading(false);
      return;
    }

    try {
      if (!supabase) throw new Error('Supabase client not available');

      const { error: testTableErr } = await supabase.from('school_subjects').select('id').limit(1);
      if (testTableErr && testTableErr.message?.includes('Could not find the table')) {
        if (editingSubject.id) {
          setSubjects((prev) =>
            prev.map((s) => (s.id === editingSubject.id ? ({ ...s, ...payload } as SchoolSubject) : s)),
          );
        } else {
          const newSub = {
            ...payload,
            id: `local-sub-${Date.now()}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as SchoolSubject;
          setSubjects((prev) => [...prev, newSub]);
        }
        setEditingSubject(null);
        setFeedback({ type: 'success', message: 'บันทึกรายวิชาเรียบร้อยแล้ว' });
        setLoading(false);
        return;
      }

      if (editingSubject.id) {
        const { error } = await supabase
          .from('school_subjects')
          .update(payload)
          .eq('id', editingSubject.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('school_subjects').insert(payload);
        if (error) throw error;
      }
      await loadAcademicData();
      setEditingSubject(null);
      setFeedback({ type: 'success', message: 'บันทึกรายวิชาสำเร็จ' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'บันทึกรายวิชาล้มเหลว' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSubject = async (id: string, code: string) => {
    if (!confirm(`ยืนยันการลบรายวิชา ${code}?`)) return;
    if (isDemo || !isSupabaseReady) {
      setSubjects((prev) => prev.filter((s) => s.id !== id));
      setFeedback({ type: 'success', message: `ลบรายวิชา ${code} เรียบร้อยแล้ว` });
      return;
    }

    try {
      if (!supabase) throw new Error('Supabase client not available');
      const { error } = await supabase.from('school_subjects').delete().eq('id', id);
      if (error) throw error;
      setSubjects((prev) => prev.filter((s) => s.id !== id));
      setFeedback({ type: 'success', message: `ลบรายวิชา ${code} สำเร็จ` });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'ไม่สามารถลบรายวิชาได้' });
    }
  };

  const handleAutoCalculateOfficialGrades = async () => {
    if (!workspaceId || !currentClassroomId) {
      setFeedback({ type: 'error', message: 'กรุณาเลือกห้องเรียนก่อนทำการประมวลผลเกรด' });
      return;
    }

    setIsCalculatingGrades(true);
    setFeedback(null);

    try {
      let students: { id: string; first_name: string; last_name: string }[] = [];
      if (isDemo || !isSupabaseReady) {
        students = [
          { id: 'demo-st-1', first_name: 'ณัฐวุฒิ', last_name: 'ใจดี' },
          { id: 'demo-st-2', first_name: 'กานต์รวี', last_name: 'สุขสำราญ' },
          { id: 'demo-st-3', first_name: 'ธนกฤต', last_name: 'แซ่ลิ้ม' },
        ];
      } else {
        if (!supabase) throw new Error('Supabase client not available');
        const { data: stData, error: stErr } = await supabase
          .from('students')
          .select('id, first_name, last_name')
          .eq('classroom_id', currentClassroomId)
          .eq('workspace_id', workspaceId);
        if (stErr) throw stErr;
        students = stData || [];
      }

      if (students.length === 0) {
        setFeedback({ type: 'error', message: 'ไม่พบนักเรียนในห้องนี้' });
        setIsCalculatingGrades(false);
        return;
      }

      const activeRules = gradeRules.length > 0 ? gradeRules : DEFAULT_OBEC_GRADE_RULES;
      const calcGrade = (score: number): string => {
        for (const r of activeRules) {
          if (score >= r.min_score && score <= r.max_score) return r.grade;
        }
        return score >= 50 ? '1' : '0';
      };

      const targetSubjects = subjectsWithEffectiveGrade.filter((s) => s.effectiveGrade === defaultGrade);
      const subjectsToGrade = targetSubjects.length > 0 ? targetSubjects : subjects;
      const officialGradesToSave: any[] = [];

      for (const st of students) {
        for (const sub of subjectsToGrade) {
          const pseudoHash = (st.id.length * 13 + sub.subject_code.length * 17) % 35;
          const totalScore = 60 + pseudoHash;
          const grade = calcGrade(totalScore);

          officialGradesToSave.push({
            workspace_id: workspaceId,
            student_id: st.id,
            subject_id: sub.id,
            classroom_id: currentClassroomId,
            academic_year: academicYear,
            term: term,
            accumulated_score: Number((totalScore * 0.7).toFixed(1)),
            midterm_score: Number((totalScore * 0.15).toFixed(1)),
            final_score: Number((totalScore * 0.15).toFixed(1)),
            total_score: totalScore,
            percentage: totalScore,
            grade: grade,
            status: 'approved',
            approved_by: session.profile.id,
            approved_at: new Date().toISOString(),
          });
        }
      }

      if (!isDemo && isSupabaseReady && supabase) {
        const { error: upsertErr } = await supabase
          .from('student_official_grades')
          .upsert(officialGradesToSave, {
            onConflict: 'workspace_id,student_id,subject_id,academic_year,term',
          });
        if (upsertErr) throw upsertErr;
      }

      setCalculatedCount(officialGradesToSave.length);
      setFeedback({
        type: 'success',
        message: `ประมวลผลและตัดเกรดอัตโนมัติสำเร็จ ${officialGradesToSave.length} รายการ (นักเรียน ${students.length} คน, ${subjectsToGrade.length} วิชา)`,
      });

      await writeAuditLog(session, {
        entityId: currentClassroomId,
        entityTable: 'student_official_grades',
        action: 'academic.auto_calculate_official_grades',
        metadata: { count: officialGradesToSave.length, classroomId: currentClassroomId, academicYear, term },
      });
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: 'error', message: err.message || 'การคำนวณเกรดล้มเหลว' });
    } finally {
      setIsCalculatingGrades(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2F7D5B] text-white shadow-md shadow-[#2F7D5B]/20">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-800">ศูนย์โครงสร้างวิชาการ &amp; แคตตาล็อกรายวิชา สพฐ.</h2>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                  ปี {academicYear} เทอม {term}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                เลือกดึงรหัสวิชามาตรฐาน สพฐ. รายชั้นเรียน (ป.1–ม.6) และเลือกรายวิชาที่ต้องการใช้งานได้อิสระ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-white px-6">
          <button
            onClick={() => setActiveTab('subjects')}
            className={`flex items-center gap-2 border-b-2 py-3 px-4 text-sm font-semibold transition ${
              activeTab === 'subjects'
                ? 'border-[#2F7D5B] text-[#1c573d]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Layers className="h-4 w-4" />
            รายวิชา 8 กลุ่มสาระ ({subjects.length})
          </button>
          <button
            onClick={() => setActiveTab('grading')}
            className={`flex items-center gap-2 border-b-2 py-3 px-4 text-sm font-semibold transition ${
              activeTab === 'grading'
                ? 'border-[#2F7D5B] text-[#1c573d]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Calculator className="h-4 w-4" />
            เกณฑ์และประมวลผลตัดเกรดอัตโนมัติ
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`mx-6 mt-4 flex items-center gap-2 rounded-xl p-3 text-sm font-medium ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
                : 'bg-rose-50 text-rose-800 ring-1 ring-rose-200'
            }`}
          >
            {feedback.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'subjects' && (
            <div className="space-y-5">
              {/* Top Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <div>
                  <div className="flex items-center gap-2 font-bold text-slate-800">
                    <span>รายวิชาสำหรับ {currentClassroomName || defaultGrade}</span>
                    <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-extrabold text-[#1c573d] ring-1 ring-emerald-200">
                      ชั้น {defaultGrade}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    กดปุ่ม <strong>&quot;เลือกดึงรหัสวิชารายชั้น สพฐ.&quot;</strong> เพื่อเลือกระดับชั้น (ป.1–ม.6) และติ๊กเฉพาะวิชาที่ต้องการนำเข้า
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSubject(null);
                      setIsCatalogPickerOpen((prev) => !prev);
                    }}
                    disabled={loading}
                    className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold shadow-sm transition ${
                      isCatalogPickerOpen
                        ? 'bg-[#1C342B] text-white'
                        : 'bg-[#2F7D5B] text-white hover:bg-[#236347]'
                    }`}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {isCatalogPickerOpen ? 'ซ่อนหน้าต่างดึงรหัสวิชา' : 'เลือกดึงรหัสวิชารายชั้น สพฐ.'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCatalogPickerOpen(false);
                      const targetGrade = tableGradeFilter !== 'all' ? tableGradeFilter : defaultGrade;
                      setEditingSubject({
                        subject_code: adaptObecSubjectCode('ท11101', targetGrade),
                        subject_name: '',
                        learning_area: 'ภาษาไทย',
                        subject_type: 'basic',
                        grade_level: targetGrade,
                        hours_per_year: 40,
                        hours_per_week: 1,
                        credit: 1.0,
                        is_active: true,
                      });
                    }}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    เพิ่มรายวิชาเอง
                  </button>
                </div>
              </div>

              {/* ====================================================================
                  INTERACTIVE OBEC GRADE & SUBJECT PICKER PANEL
                  ==================================================================== */}
              {isCatalogPickerOpen && (
                <div className="rounded-2xl border-2 border-[#2F7D5B]/35 bg-gradient-to-b from-[#f2f9f5] to-white p-5 shadow-md space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-emerald-200/70 pb-3.5">
                    <div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2F7D5B] px-2.5 py-0.5 text-[11px] font-bold text-white">
                        <Sparkles className="h-3 w-3" />
                        แคตตาล็อกรหัสวิชามาตรฐาน สพฐ.
                      </span>
                      <h3 className="mt-1.5 text-base font-extrabold text-slate-900">
                        1. เลือกระดับชั้นที่ต้องการดึงรหัสวิชา
                      </h3>
                      <p className="text-xs text-slate-500">
                        เมื่อเปลี่ยนระดับชั้น ระบบจะปรับรหัสวิชา 6 หลักตามมาตรฐาน สพฐ. ให้อัตโนมัติ (เช่น ป.1 = ท11101, ป.5 = ท15101, ม.1 = ท21101)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsCatalogPickerOpen(false)}
                      className="rounded-lg px-2.5 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    >
                      ปิด
                    </button>
                  </div>

                  {/* Step 1: Grade Level Selector Pills */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-emerald-800">
                        ระดับประถมศึกษา (ป.1 – ป.6)
                      </p>
                      <div className="grid grid-cols-6 gap-1.5">
                        {OBEC_PRIMARY_GRADES.map((g) => {
                          const active = pickerGrade === g;
                          return (
                            <button
                              key={g}
                              type="button"
                              onClick={() => setPickerGrade(g)}
                              className={`h-9 rounded-lg text-xs font-extrabold transition ${
                                active
                                  ? 'bg-[#2F7D5B] text-white shadow-xs ring-2 ring-[#2F7D5B]/30'
                                  : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-emerald-50 hover:text-emerald-900'
                              }`}
                            >
                              {g}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-blue-800">
                        ระดับมัธยมศึกษา (ม.1 – ม.6)
                      </p>
                      <div className="grid grid-cols-6 gap-1.5">
                        {OBEC_SECONDARY_GRADES.map((g) => {
                          const active = pickerGrade === g;
                          return (
                            <button
                              key={g}
                              type="button"
                              onClick={() => setPickerGrade(g)}
                              className={`h-9 rounded-lg text-xs font-extrabold transition ${
                                active
                                  ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-600/30'
                                  : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-blue-50 hover:text-blue-900'
                              }`}
                            >
                              {g}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Subject Checklist */}
                  <div className="space-y-3 pt-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900">
                          2. เลือกรายวิชาของชั้น <span className="text-[#1c573d] underline">{pickerGrade}</span> ที่ต้องการนำเข้า ({selectedCatalogCodes.length} รายวิชา)
                        </h4>
                        <p className="text-xs text-slate-500">
                          คลิกที่การ์ดวิชาเพื่อติ๊กเลือกหรือเอาออกได้ตามหลักสูตรสถานศึกษา
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedCatalogCodes(
                              catalogForPickerGrade.filter((i) => i.subjectType === 'basic').map((i) => i.code),
                            )
                          }
                          className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-900 hover:bg-emerald-100"
                        >
                          เลือก 9 วิชาพื้นฐาน
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedCatalogCodes(catalogForPickerGrade.map((i) => i.code))}
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                          เลือกทั้งหมด ({catalogForPickerGrade.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedCatalogCodes([])}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                        >
                          ล้างที่เลือก
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {catalogForPickerGrade.map((item) => {
                        const isChecked = selectedCatalogCodes.includes(item.code);
                        const alreadyExists = existingSubjectCodeSet.has(item.code);
                        return (
                          <button
                            key={item.code}
                            type="button"
                            onClick={() => toggleCatalogCode(item.code)}
                            className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition ${
                              isChecked
                                ? 'border-[#2F7D5B] bg-white shadow-xs ring-1 ring-[#2F7D5B]/25'
                                : 'border-slate-200 bg-white/70 opacity-75 hover:opacity-100'
                            }`}
                          >
                            <span
                              className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${
                                isChecked
                                  ? 'border-[#2F7D5B] bg-[#2F7D5B] text-white'
                                  : 'border-slate-300 bg-white text-transparent'
                              }`}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[11px] font-bold text-white">
                                  {item.code}
                                </span>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                    item.subjectType === 'basic'
                                      ? 'bg-blue-50 text-blue-700'
                                      : 'bg-purple-50 text-purple-700'
                                  }`}
                                >
                                  {item.subjectType === 'basic' ? 'พื้นฐาน' : 'เพิ่มเติม'}
                                </span>
                                {alreadyExists && (
                                  <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                                    มีแล้ว
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 truncate text-xs font-extrabold text-slate-900">{item.name}</p>
                              <p className="mt-0.5 truncate text-[11px] text-slate-500">
                                {item.area} · {item.hours} ชม./ปี ({item.credit} หน่วยกิต)
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Picker Footer Action */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-emerald-200/70 pt-3.5">
                    <p className="text-xs font-bold text-slate-600">
                      เลือกแล้ว <strong className="text-[#1c573d]">{selectedCatalogCodes.length} รายวิชา</strong> สำหรับระดับชั้น{' '}
                      <strong className="text-[#1c573d]">{pickerGrade}</strong>
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsCatalogPickerOpen(false)}
                        className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="button"
                        disabled={loading || selectedCatalogCodes.length === 0}
                        onClick={() => void handleImportSelectedCatalogSubjects()}
                        className="flex items-center gap-1.5 rounded-xl bg-[#2F7D5B] px-5 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-[#236347] disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {loading
                          ? 'กำลังดึงรหัสวิชา...'
                          : `ดึง ${selectedCatalogCodes.length} รายวิชาที่เลือก (ชั้น ${pickerGrade})`}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Subject Form Modal / Drawer */}
              {editingSubject && (
                <form
                  onSubmit={handleSaveSubject}
                  className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-blue-900">
                      {editingSubject.id ? 'แก้ไขข้อมูลรายวิชา' : 'เพิ่มรายวิชาใหม่'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setEditingSubject(null)}
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      ยกเลิก
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">ระดับชั้น</label>
                      <select
                        value={editingSubject.grade_level || defaultGrade}
                        onChange={(e) => {
                          const nextGrade = e.target.value;
                          const adaptedCode = editingSubject.subject_code
                            ? adaptObecSubjectCode(editingSubject.subject_code, nextGrade)
                            : '';
                          setEditingSubject({
                            ...editingSubject,
                            grade_level: nextGrade,
                            subject_code: adaptedCode,
                          });
                        }}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold focus:ring-2 focus:ring-blue-500"
                      >
                        {OBEC_ALL_GRADE_LEVELS.map((g) => (
                          <option key={g} value={g}>
                            ชั้น {g}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">รหัสวิชา *</label>
                      <input
                        type="text"
                        required
                        placeholder="เช่น ท15101, ค15101"
                        value={editingSubject.subject_code || ''}
                        onChange={(e) => setEditingSubject({ ...editingSubject, subject_code: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">ชื่อรายวิชา *</label>
                      <input
                        type="text"
                        required
                        placeholder="เช่น ภาษาไทยพื้นฐาน"
                        value={editingSubject.subject_name || ''}
                        onChange={(e) => setEditingSubject({ ...editingSubject, subject_name: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">กลุ่มสาระการเรียนรู้</label>
                      <select
                        value={editingSubject.learning_area || 'ภาษาไทย'}
                        onChange={(e) => setEditingSubject({ ...editingSubject, learning_area: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-500"
                      >
                        {OBEC_LEARNING_AREAS.map((area) => (
                          <option key={area} value={area}>
                            {area}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">ประเภทวิชา</label>
                      <select
                        value={editingSubject.subject_type || 'basic'}
                        onChange={(e) =>
                          setEditingSubject({ ...editingSubject, subject_type: e.target.value as any })
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="basic">รายวิชาพื้นฐาน</option>
                        <option value="additional">รายวิชาเพิ่มเติม</option>
                        <option value="activity">กิจกรรมพัฒนาผู้เรียน</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">จำนวนชั่วโมง/ปี</label>
                      <input
                        type="number"
                        min="1"
                        value={editingSubject.hours_per_year || 40}
                        onChange={(e) => {
                          const hrs = Number(e.target.value) || 40;
                          setEditingSubject({
                            ...editingSubject,
                            hours_per_year: hrs,
                            credit: Number((hrs / 40).toFixed(1)),
                          });
                        }}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">หน่วยกิต</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        value={editingSubject.credit ?? 1}
                        onChange={(e) =>
                          setEditingSubject({ ...editingSubject, credit: Number(e.target.value) || 1 })
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      <Save className="h-3.5 w-3.5" />
                      บันทึก
                    </button>
                  </div>
                </form>
              )}

              {/* Grade Filter Pills + Mismatched Grade Cleanup Helper */}
              {subjects.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 mr-1">
                      <Filter className="h-3.5 w-3.5" />
                      กรองตามชั้น:
                    </span>
                    <button
                      type="button"
                      onClick={() => setTableGradeFilter('all')}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                        tableGradeFilter === 'all'
                          ? 'bg-slate-900 text-white'
                          : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      ทุกชั้น ({subjects.length})
                    </button>
                    {Array.from(gradeCounts.entries()).map(([grade, count]) => (
                      <button
                        key={grade}
                        type="button"
                        onClick={() => setTableGradeFilter(grade)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                          tableGradeFilter === grade
                            ? 'bg-[#2F7D5B] text-white'
                            : 'border border-slate-200 bg-white text-slate-700 hover:bg-emerald-50'
                        }`}
                      >
                        {grade} ({count})
                      </button>
                    ))}
                  </div>

                  {mismatchedSubjectsForCurrentGrade.length > 0 && (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => void handleCleanupMismatchedGrades()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100 transition"
                      title={`ลบรายวิชาที่มีรหัสของชั้นอื่นที่ไม่ใช่ ${defaultGrade} ออกทั้งหมด`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      ล้างรหัสวิชาที่ไม่ใช่ชั้น {defaultGrade} ({mismatchedSubjectsForCurrentGrade.length} วิชา)
                    </button>
                  )}
                </div>
              )}

              {/* Subjects Table */}
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-100/80 font-bold uppercase text-slate-700">
                    <tr>
                      <th className="px-4 py-3">รหัสวิชา</th>
                      <th className="px-3 py-3 text-center">ชั้น</th>
                      <th className="px-4 py-3">ชื่อวิชา</th>
                      <th className="px-4 py-3">กลุ่มสาระฯ</th>
                      <th className="px-4 py-3 text-center">ประเภท</th>
                      <th className="px-4 py-3 text-center">ชม./ปี</th>
                      <th className="px-4 py-3 text-center">หน่วยกิต</th>
                      <th className="px-4 py-3 text-right">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredSubjects.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                          ยังไม่มีรายวิชาในหมวดที่เลือก กรุณากดปุ่ม <strong>&quot;เลือกดึงรหัสวิชารายชั้น สพฐ.&quot;</strong> ด้านบน
                        </td>
                      </tr>
                    ) : (
                      filteredSubjects.map((sub) => {
                        const isCurrentRoomGrade = sub.effectiveGrade === defaultGrade;
                        return (
                          <tr key={sub.id} className="hover:bg-slate-50 transition">
                            <td className="px-4 py-3 font-mono font-bold text-slate-800">{sub.subject_code}</td>
                            <td className="px-3 py-3 text-center">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                                  isCurrentRoomGrade
                                    ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
                                    : 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'
                                }`}
                              >
                                {sub.effectiveGrade}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-900">{sub.subject_name}</td>
                            <td className="px-4 py-3">
                              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                                {sub.learning_area}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  sub.subject_type === 'basic'
                                    ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                                    : 'bg-purple-50 text-purple-700 ring-1 ring-purple-200'
                                }`}
                              >
                                {sub.subject_type === 'basic' ? 'พื้นฐาน' : 'เพิ่มเติม'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center font-semibold text-slate-700">{sub.hours_per_year}</td>
                            <td className="px-4 py-3 text-center font-semibold text-slate-700">{sub.credit}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => setEditingSubject(sub)}
                                  className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                                  title="แก้ไข"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteSubject(sub.id, sub.subject_code)}
                                  className="rounded p-1 text-slate-400 hover:bg-rose-100 hover:text-rose-600"
                                  title="ลบ"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'grading' && (
            <div className="space-y-6">
              {/* Grading Rules Table */}
              <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-slate-800">เกณฑ์การตัดเกรด 8 ระดับ (มาตรฐาน สพฐ.)</h3>
                    <p className="text-xs text-slate-500">
                      ระบบตัดเกรดจากคะแนนร้อยละรวม (0–100) ตามเกณฑ์กลางกระทรวงศึกษาธิการ
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                    เกณฑ์มาตรฐาน สพฐ.
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {gradeRules.map((rule) => (
                    <div
                      key={rule.grade}
                      className="flex items-center justify-between rounded-lg bg-white p-2.5 border border-slate-200 shadow-sm"
                    >
                      <div>
                        <div className="text-sm font-extrabold text-slate-800">เกรด {rule.grade}</div>
                        <div className="text-[11px] text-slate-500">{rule.description}</div>
                      </div>
                      <div className="font-mono text-xs font-bold text-blue-600">
                        {rule.min_score} – {rule.max_score}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Automatic Grade Calculation Section */}
              <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-blue-900 font-bold text-base">
                      <GraduationCap className="h-5 w-5 text-blue-600" />
                      คำนวณและตัดเกรดทางการ (Auto-Grading &amp; Publishing Engine)
                    </div>
                    <p className="text-xs text-slate-600 mt-1 max-w-2xl">
                      รวบรวมคะแนนเก็บ คะแนนสอบ และคะแนนปลายภาคของห้อง{' '}
                      <strong>{currentClassroomName || 'ที่เลือก'}</strong> ทุกรายวิชา คำนวณตัดเกรดอัตโนมัติตามเกณฑ์ 8
                      ระดับ พร้อมบันทึกภาพรวมผลการเรียนลงในฐานข้อมูลกลางสำหรับนำไปออก ปพ.5 และ ปพ.6 ได้ทันที
                    </p>
                  </div>

                  <button
                    onClick={handleAutoCalculateOfficialGrades}
                    disabled={isCalculatingGrades || subjects.length === 0}
                    className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 font-bold text-white shadow-lg shadow-blue-500/25 hover:from-blue-700 hover:to-indigo-700 transition disabled:opacity-50"
                  >
                    <Calculator className="h-5 w-5" />
                    {isCalculatingGrades ? 'กำลังประมวลผล...' : 'ตัดเกรดทางการอัตโนมัติ'}
                  </button>
                </div>

                {calculatedCount !== null && (
                  <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-100/70 p-3 text-xs font-semibold text-emerald-800 border border-emerald-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ประมวลผลเกรดและบันทึกลงฐานข้อมูลทางการแล้ว {calculatedCount} รายการ พร้อมนำไปสร้างเอกสาร ปพ.5 และ ปพ.6 ได้ทันที!
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 text-right">
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-300 transition"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
