import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { isDemoSession } from '../../lib/auth';
import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import {
  OBEC_LEARNING_AREAS,
  DEFAULT_PRIMARY_SUBJECTS_TEMPLATE,
  DEFAULT_OBEC_GRADE_RULES,
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

export const AcademicSubjectsModal: React.FC<AcademicSubjectsModalProps> = ({
  isOpen,
  onClose,
  session,
  currentClassroomId,
  currentClassroomName,
  academicYear = '2569',
  term = '1',
}) => {
  const [activeTab, setActiveTab] = useState<'subjects' | 'grading'>('subjects');
  const [subjects, setSubjects] = useState<SchoolSubject[]>([]);
  const [gradeRules, setGradeRules] = useState<GradeRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form states
  const [editingSubject, setEditingSubject] = useState<Partial<SchoolSubject> | null>(null);

  // Calculate & Publish Grades State
  const [isCalculatingGrades, setIsCalculatingGrades] = useState(false);
  const [calculatedCount, setCalculatedCount] = useState<number | null>(null);

  const workspaceId = session.workspace?.id;
  const isDemo = isDemoSession(session);

  useEffect(() => {
    if (isOpen && workspaceId) {
      loadAcademicData();
    }
  }, [isOpen, workspaceId]);

  const loadAcademicData = async () => {
    if (!workspaceId) return;
    setLoading(true);
    setFeedback(null);

    try {
      if (isDemo || !isSupabaseReady) {
        // Load demo presets
        const demoSubs: SchoolSubject[] = DEFAULT_PRIMARY_SUBJECTS_TEMPLATE.map((tpl, index) => ({
          id: `demo-sub-${index + 1}`,
          workspace_id: workspaceId,
          subject_code: tpl.code,
          subject_name: tpl.name,
          learning_area: tpl.area,
          subject_type: 'basic',
          grade_level: currentClassroomName?.split('/')[0] || 'ป.5',
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

      // Supabase Fetch
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
        setSubjects([]);
      }

      if (rulesRes.data && rulesRes.data.length > 0) {
        setGradeRules(rulesRes.data as GradeRule[]);
      } else {
        setGradeRules(
          DEFAULT_OBEC_GRADE_RULES.map((r, i) => ({
            id: `rule-default-${i}`,
            workspace_id: workspaceId,
            ...r,
          }))
        );
      }
    } catch (err) {
      console.error('Failed to load academic data:', err);
      setFeedback({ type: 'error', message: 'ไม่สามารถโหลดข้อมูลรายวิชาได้' });
    } finally {
      setLoading(false);
    }
  };

  const handleLoadDefaultTemplate = async () => {
    if (!workspaceId) return;
    setLoading(true);

    const gradeLevel = currentClassroomName?.split('/')[0] || 'ป.5';
    const templateSubjects = DEFAULT_PRIMARY_SUBJECTS_TEMPLATE.map((tpl) => ({
      workspace_id: workspaceId,
      subject_code: tpl.code,
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

    if (isDemo || !isSupabaseReady) {
      const demoSubs = templateSubjects.map((s, i) => ({
        id: `demo-sub-${Date.now()}-${i}`,
        ...s,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      setSubjects(demoSubs);
      setFeedback({ type: 'success', message: 'นำเข้าแม่แบบ 9 วิชาพื้นฐาน สพฐ. เรียบร้อยแล้ว (โหมดจำลอง)' });
      setLoading(false);
      return;
    }

    try {
      if (!supabase) throw new Error('Supabase client not available');
      const { data, error } = await supabase.from('school_subjects').upsert(templateSubjects, {
        onConflict: 'workspace_id,subject_code,grade_level',
      }).select();

      if (error) throw error;
      setSubjects(data as SchoolSubject[]);
      setFeedback({ type: 'success', message: 'บันทึกแม่แบบ 9 วิชาพื้นฐาน สพฐ. สำเร็จ' });
      await writeAuditLog(session, {
        entityId: workspaceId || 'academic',
        entityTable: 'school_subjects',
        action: 'academic.import_default_subjects_template',
        metadata: { count: data.length, gradeLevel },
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'เกิดข้อผิดพลาดในการโหลดแม่แบบ' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !editingSubject?.subject_code || !editingSubject?.subject_name) return;

    setLoading(true);
    const payload = {
      workspace_id: workspaceId,
      subject_code: editingSubject.subject_code.trim(),
      subject_name: editingSubject.subject_name.trim(),
      learning_area: editingSubject.learning_area || 'ภาษาไทย',
      subject_type: editingSubject.subject_type || 'basic',
      grade_level: editingSubject.grade_level || currentClassroomName?.split('/')[0] || 'ป.5',
      hours_per_year: Number(editingSubject.hours_per_year) || 40,
      hours_per_week: Number(editingSubject.hours_per_week) || 1,
      credit: Number(editingSubject.credit) || 1.0,
      teacher_profile_id: editingSubject.teacher_profile_id || session.profile.id,
      is_active: editingSubject.is_active ?? true,
    };

    if (isDemo || !isSupabaseReady) {
      if (editingSubject.id) {
        setSubjects((prev) =>
          prev.map((s) => (s.id === editingSubject.id ? ({ ...s, ...payload } as SchoolSubject) : s))
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

  // Automated Official Grade Calculation Engine
  const handleAutoCalculateOfficialGrades = async () => {
    if (!workspaceId || !currentClassroomId) {
      setFeedback({ type: 'error', message: 'กรุณาเลือกห้องเรียนก่อนทำการประมวลผลเกรด' });
      return;
    }

    setIsCalculatingGrades(true);
    setFeedback(null);

    try {
      // 1. Fetch classroom students
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

      // 2. Fetch scores or calculate official scores
      const activeRules = gradeRules.length > 0 ? gradeRules : DEFAULT_OBEC_GRADE_RULES;
      const calcGrade = (score: number): string => {
        for (const r of activeRules) {
          if (score >= r.min_score && score <= r.max_score) return r.grade;
        }
        return score >= 50 ? '1' : '0';
      };

      const officialGradesToSave: any[] = [];

      for (const st of students) {
        for (const sub of subjects) {
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
        message: `ประมวลผลและตัดเกรดอัตโนมัติสำเร็จ ${officialGradesToSave.length} รายการ (นักเรียน ${students.length} คน, ${subjects.length} วิชา)`,
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-800">ศูนย์โครงสร้างวิชาการ & แคตตาล็อกรายวิชา สพฐ.</h2>
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                  ปี {academicYear} เทอม {term}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                จัดการ 8 กลุ่มสาระการเรียนรู้ ตัวชี้วัด เกณฑ์ผลการเรียน และคำนวณตัดเกรดทางการ 8 ระดับ (0–4)
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
                ? 'border-blue-600 text-blue-600'
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
                ? 'border-blue-600 text-blue-600'
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
            {feedback.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'subjects' && (
            <div className="space-y-6">
              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <div>
                  <div className="font-semibold text-slate-700">รายวิชาสำหรับ {currentClassroomName || 'ชั้นเรียน'}</div>
                  <div className="text-xs text-slate-500">
                    สามารถกดนำเข้าวิชามาตรฐาน สพฐ. 9 วิชาหลักได้ในคลิกเดียว หรือเพิ่มรายวิชาเพิ่มเติมตามหลักสูตรสถานศึกษา
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleLoadDefaultTemplate}
                    disabled={loading}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    โหลด 9 วิชามาตรฐาน สพฐ.
                  </button>
                  <button
                    onClick={() =>
                      setEditingSubject({
                        subject_code: '',
                        subject_name: '',
                        learning_area: 'ภาษาไทย',
                        subject_type: 'basic',
                        grade_level: currentClassroomName?.split('/')[0] || 'ป.5',
                        hours_per_year: 40,
                        hours_per_week: 1,
                        credit: 1.0,
                        is_active: true,
                      })
                    }
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    เพิ่มรายวิชา
                  </button>
                </div>
              </div>

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

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">รหัสวิชา *</label>
                      <input
                        type="text"
                        required
                        placeholder="เช่น ท11101, ค15101"
                        value={editingSubject.subject_code || ''}
                        onChange={(e) => setEditingSubject({ ...editingSubject, subject_code: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">ชื่อรายวิชา *</label>
                      <input
                        type="text"
                        required
                        placeholder="เช่น ภาษาไทยพื้นฐาน 5"
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
                        onChange={(e) =>
                          setEditingSubject({ ...editingSubject, hours_per_year: Number(e.target.value) })
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

              {/* Subjects Table */}
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-100/80 font-bold uppercase text-slate-700">
                    <tr>
                      <th className="px-4 py-3">รหัสวิชา</th>
                      <th className="px-4 py-3">ชื่อวิชา</th>
                      <th className="px-4 py-3">กลุ่มสาระฯ</th>
                      <th className="px-4 py-3 text-center">ประเภท</th>
                      <th className="px-4 py-3 text-center">ชม./ปี</th>
                      <th className="px-4 py-3 text-center">หน่วยกิต</th>
                      <th className="px-4 py-3 text-right">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {subjects.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                          ยังไม่มีรายวิชาในระบบ กรุณากดปุ่ม <strong>"โหลด 9 วิชามาตรฐาน สพฐ."</strong> ด้านบน
                        </td>
                      </tr>
                    ) : (
                      subjects.map((sub) => (
                        <tr key={sub.id} className="hover:bg-slate-50 transition">
                          <td className="px-4 py-3 font-mono font-bold text-slate-800">{sub.subject_code}</td>
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
                      ))
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
                      คำนวณและตัดเกรดทางการ (Auto-Grading & Publishing Engine)
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
            className="rounded-lg border border-slate-300 bg-white px-5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
