import type { AnswerSheetConfig, ExamBankTemplate } from '../types/omr';
import type { AppSessionContext } from '../types/core';
import { isSupabaseReady, supabase } from './supabaseClient';

const STORAGE_KEY = 'classcare_omr_exam_bank';
const STORAGE_DRAFT_KEY = 'classcare_omr_active_draft';

const DEFAULT_TEMPLATES: ExamBankTemplate[] = [
  {
    id: 'bank_standard_midterm',
    title: 'แบบทดสอบวัดผลกลางภาคเรียน (30 ข้อ 4 ตัวเลือก)',
    subjectName: 'วิทยาศาสตร์และเทคโนโลยี',
    schoolName: 'โรงเรียน ClassCare 360',
    teacherId: 'teacher_master_demo',
    teacherName: 'ครูประจำวิชาวิทยาศาสตร์',
    isSharedToSchool: true,
    academicYear: '2568',
    term: '1',
    isUniversalRoom: true,
    totalQuestions: 30,
    choicesCount: 4,
    choiceLabelType: 'THAI',
    layout: 'single_full',
    studentIdFormat: 'roll_number',
    totalScore: 30,
    themeColor: 'slate',
    examSet: '01',
    examSets: {
      '01': {
        1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'A',
        6: 'B', 7: 'C', 8: 'D', 9: 'A', 10: 'B',
        11: 'C', 12: 'D', 13: 'A', 14: 'B', 15: 'C',
        16: 'D', 17: 'A', 18: 'B', 19: 'C', 20: 'D',
        21: 'A', 22: 'B', 23: 'C', 24: 'D', 25: 'A',
        26: 'B', 27: 'C', 28: 'D', 29: 'A', 30: 'B',
      },
      '02': {
        1: 'D', 2: 'C', 3: 'B', 4: 'A', 5: 'D',
        6: 'C', 7: 'B', 8: 'A', 9: 'D', 10: 'C',
        11: 'B', 12: 'A', 13: 'D', 14: 'C', 15: 'B',
        16: 'A', 17: 'D', 18: 'C', 19: 'B', 20: 'A',
        21: 'D', 22: 'C', 23: 'B', 24: 'A', 25: 'D',
        26: 'C', 27: 'B', 28: 'A', 29: 'D', 30: 'C',
      },
    },
    answerKeys: {
      1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'A',
      6: 'B', 7: 'C', 8: 'D', 9: 'A', 10: 'B',
      11: 'C', 12: 'D', 13: 'A', 14: 'B', 15: 'C',
      16: 'D', 17: 'A', 18: 'B', 19: 'C', 20: 'D',
      21: 'A', 22: 'B', 23: 'C', 24: 'D', 25: 'A',
      26: 'B', 27: 'C', 28: 'D', 29: 'A', 30: 'B',
    },
    pointsPerQuestion: Object.fromEntries(Array.from({ length: 30 }, (_, i) => [i + 1, 1])),
    savedAt: new Date().toISOString(),
  },
  {
    id: 'bank_standard_quiz_20',
    title: 'แบบทดสอบย่อยประจำหน่วย (20 ข้อ ประหยัดกระดาษ 2-in-1)',
    subjectName: 'คณิตศาสตร์พื้นฐาน',
    schoolName: 'โรงเรียน ClassCare 360',
    teacherId: 'teacher_master_demo',
    teacherName: 'ครูประจำวิชาคณิตศาสตร์',
    isSharedToSchool: true,
    academicYear: '2568',
    term: '1',
    isUniversalRoom: true,
    totalQuestions: 20,
    choicesCount: 4,
    choiceLabelType: 'THAI',
    layout: 'eco_half',
    studentIdFormat: 'roll_number',
    totalScore: 20,
    themeColor: 'navy',
    examSet: '01',
    examSets: {
      '01': {
        1: 'B', 2: 'A', 3: 'C', 4: 'D', 5: 'B',
        6: 'A', 7: 'C', 8: 'D', 9: 'B', 10: 'A',
        11: 'C', 12: 'D', 13: 'B', 14: 'A', 15: 'C',
        16: 'D', 17: 'B', 18: 'A', 19: 'C', 20: 'D',
      },
    },
    answerKeys: {
      1: 'B', 2: 'A', 3: 'C', 4: 'D', 5: 'B',
      6: 'A', 7: 'C', 8: 'D', 9: 'B', 10: 'A',
      11: 'C', 12: 'D', 13: 'B', 14: 'A', 15: 'C',
      16: 'D', 17: 'B', 18: 'A', 19: 'C', 20: 'D',
    },
    pointsPerQuestion: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [i + 1, 1])),
    savedAt: new Date().toISOString(),
  },
];

/**
 * Synchronously get cached templates from LocalStorage for instant rendering.
 */
export function getExamBankTemplates(): ExamBankTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_TEMPLATES));
      return DEFAULT_TEMPLATES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return DEFAULT_TEMPLATES;
  } catch (e) {
    console.warn('[ExamBank] Failed to read from localStorage:', e);
    return DEFAULT_TEMPLATES;
  }
}

/**
 * Transform DB row from omr_exam_templates into frontend ExamBankTemplate.
 */
function mapDbRowToTemplate(row: any): ExamBankTemplate {
  return {
    id: row.id,
    title: row.title,
    subjectName: row.subject_name || 'วิชาทั่วไป',
    schoolName: row.school_name || undefined,
    teacherId: row.teacher_id || undefined,
    teacherName: row.teacher_name || undefined,
    workspaceId: row.workspace_id,
    isSharedToSchool: row.is_shared_to_school ?? true,
    academicYear: row.academic_year || '2568',
    term: row.term || '1',
    roomName: row.room_name || undefined,
    isUniversalRoom: row.is_universal_room !== false,
    totalQuestions: row.total_questions || 20,
    choicesCount: (row.choices_count as 3 | 4 | 5) || 4,
    choiceLabelType: row.choice_label_type || 'THAI',
    layout: row.layout || 'eco_half',
    studentIdFormat: row.student_id_format || 'roll_number',
    totalScore: Number(row.total_score || row.total_questions || 20),
    themeColor: row.theme_color || 'slate',
    examSet: row.exam_set || '01',
    examSets: row.exam_sets || {},
    answerKeys: row.answer_keys || {},
    pointsPerQuestion: row.points_per_question || {},
    savedAt: row.updated_at || row.created_at || new Date().toISOString(),
  };
}

/**
 * Fetch all exam templates from Supabase Cloud.
 * Syncs and merges with LocalStorage so both PC and Mobile have identical lists.
 */
export async function fetchCloudExamTemplates(
  workspaceId?: string,
  profileId?: string
): Promise<ExamBankTemplate[]> {
  const localTemplates = getExamBankTemplates();
  if (!isSupabaseReady || !supabase) {
    return localTemplates;
  }

  const cloudTemplates: ExamBankTemplate[] = [];

  // Strategy 1: Dedicated omr_exam_templates table (filtered to teacher's own exams or shared exams)
  if (workspaceId) {
    try {
      let query = supabase
        .from('omr_exam_templates')
        .select('*')
        .eq('workspace_id', workspaceId);

      if (profileId) {
        query = query.or(`teacher_id.eq.${profileId},is_shared_to_school.eq.true`);
      }

      const { data, error } = await query.order('updated_at', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        data.forEach((r) => cloudTemplates.push(mapDbRowToTemplate(r)));
      }
    } catch {
      // Table might not exist yet on remote instance; continue to fallback
    }
  }

  // Strategy 2: Profile metadata fallback (available immediately on any Supabase schema)
  if (profileId) {
    try {
      const { data: prof } = await supabase
        .from('profiles')
        .select('metadata')
        .eq('id', profileId)
        .maybeSingle();

      const meta = (prof?.metadata as Record<string, any>) || {};
      if (Array.isArray(meta.omr_exam_bank) && meta.omr_exam_bank.length > 0) {
        meta.omr_exam_bank.forEach((item: ExamBankTemplate) => {
          if (!cloudTemplates.some((c) => c.id === item.id)) {
            cloudTemplates.push(item);
          }
        });
      }
    } catch {
      // ignore
    }
  }

  // Merge cloud templates with local templates (cloud takes precedence for same IDs)
  const templateMap = new Map<string, ExamBankTemplate>();
  DEFAULT_TEMPLATES.forEach((t) => templateMap.set(t.id, t));
  localTemplates.forEach((t) => templateMap.set(t.id, t));
  cloudTemplates.forEach((t) => templateMap.set(t.id, t));

  const merged = Array.from(templateMap.values()).sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
  );

  // Update local cache
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // ignore quota error
  }

  return merged;
}

/**
 * Save an exam template to both LocalStorage AND Supabase Cloud.
 */
export async function saveCloudExamTemplate(
  config: AnswerSheetConfig,
  overrides?: Partial<ExamBankTemplate>,
  session?: AppSessionContext | null
): Promise<ExamBankTemplate> {
  const currentTemplates = getExamBankTemplates();
  const templateId = overrides?.id || config.id || `bank_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const examSets = { ...(config.examSets || {}) };
  const currentSet = config.examSet || '01';
  examSets[currentSet] = { ...config.answerKeys };

  const effectiveWorkspaceId = overrides?.workspaceId || session?.workspace?.id || undefined;
  const effectiveTeacherId = overrides?.teacherId || session?.profile?.id || config.teacherId || undefined;
  const effectiveTeacherName = overrides?.teacherName || session?.profile?.displayName || config.teacherName || 'ครูผู้สอน';

  const newTemplate: ExamBankTemplate = {
    id: templateId,
    title: overrides?.title || config.title || 'ชุดข้อสอบบันทึกใหม่',
    subjectName: overrides?.subjectName || config.subjectName || 'วิชาทั่วไป',
    schoolName: overrides?.schoolName || config.schoolName || session?.workspace?.name,
    teacherId: effectiveTeacherId,
    teacherName: effectiveTeacherName,
    workspaceId: effectiveWorkspaceId,
    isSharedToSchool: overrides?.isSharedToSchool ?? true,
    academicYear: overrides?.academicYear || config.academicYear || '2568',
    term: overrides?.term || config.term || '1',
    roomName: overrides?.roomName || config.roomName,
    isUniversalRoom: config.isUniversalRoom !== false,
    totalQuestions: config.totalQuestions,
    choicesCount: config.choicesCount,
    choiceLabelType: config.choiceLabelType,
    layout: config.layout,
    studentIdFormat: config.studentIdFormat,
    totalScore: config.totalScore,
    themeColor: config.themeColor || 'slate',
    examSet: currentSet,
    examSets,
    answerKeys: { ...config.answerKeys },
    pointsPerQuestion: { ...config.pointsPerQuestion },
    savedAt: new Date().toISOString(),
  };

  // 1. Immediate local save for responsiveness
  const existingIdx = currentTemplates.findIndex((t) => t.id === templateId);
  let updatedList: ExamBankTemplate[];
  if (existingIdx >= 0) {
    updatedList = [...currentTemplates];
    updatedList[existingIdx] = newTemplate;
  } else {
    updatedList = [newTemplate, ...currentTemplates];
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
  } catch (e) {
    console.warn('[ExamBank] Failed to persist template to localStorage:', e);
  }

  // 2. Cloud Persistence (Supabase)
  if (isSupabaseReady && supabase) {
    // 2.1 Insert/Upsert into omr_exam_templates table
    if (effectiveWorkspaceId) {
      try {
        await supabase.from('omr_exam_templates').upsert({
          id: templateId,
          workspace_id: effectiveWorkspaceId,
          teacher_id: effectiveTeacherId || null,
          title: newTemplate.title,
          subject_name: newTemplate.subjectName,
          academic_year: newTemplate.academicYear,
          term: newTemplate.term,
          room_name: newTemplate.roomName || null,
          school_name: newTemplate.schoolName || null,
          is_universal_room: newTemplate.isUniversalRoom,
          total_questions: newTemplate.totalQuestions,
          choices_count: newTemplate.choicesCount,
          choice_label_type: newTemplate.choiceLabelType,
          layout: newTemplate.layout,
          student_id_format: newTemplate.studentIdFormat,
          total_score: newTemplate.totalScore,
          theme_color: newTemplate.themeColor,
          exam_set: newTemplate.examSet,
          exam_sets: newTemplate.examSets,
          answer_keys: newTemplate.answerKeys,
          points_per_question: newTemplate.pointsPerQuestion,
          is_shared_to_school: newTemplate.isSharedToSchool,
          updated_at: new Date().toISOString(),
        });
      } catch {
        // Table might not be pushed yet
      }
    }

    // 2.2 Profile metadata backup sync
    if (effectiveTeacherId) {
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('metadata')
          .eq('id', effectiveTeacherId)
          .maybeSingle();

        const currentMeta = (prof?.metadata as Record<string, any>) || {};
        const metaBank: ExamBankTemplate[] = Array.isArray(currentMeta.omr_exam_bank)
          ? [...currentMeta.omr_exam_bank]
          : [];

        const metaIdx = metaBank.findIndex((m) => m.id === templateId);
        if (metaIdx >= 0) metaBank[metaIdx] = newTemplate;
        else metaBank.unshift(newTemplate);

        await supabase
          .from('profiles')
          .update({
            metadata: {
              ...currentMeta,
              omr_exam_bank: metaBank.slice(0, 30),
              omr_active_draft: {
                ...config,
                id: templateId,
                title: newTemplate.title,
                answerKeys: newTemplate.answerKeys,
                examSets: newTemplate.examSets,
              },
            },
          })
          .eq('id', effectiveTeacherId);
      } catch {
        // ignore
      }
    }
  }

  return newTemplate;
}

/**
 * Backward compatible synchronous save function.
 */
export function saveExamBankTemplate(
  config: AnswerSheetConfig,
  overrides?: Partial<ExamBankTemplate>,
  session?: AppSessionContext | null
): ExamBankTemplate {
  // Trigger cloud sync in background
  saveCloudExamTemplate(config, overrides, session).catch((err) =>
    console.warn('[ExamBank] Cloud sync warning:', err)
  );

  // Return synchronous result immediately for UI responsiveness
  const currentTemplates = getExamBankTemplates();
  const templateId = overrides?.id || `bank_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const examSets = { ...(config.examSets || {}) };
  const currentSet = config.examSet || '01';
  examSets[currentSet] = { ...config.answerKeys };

  const newTemplate: ExamBankTemplate = {
    id: templateId,
    title: overrides?.title || config.title || 'ชุดข้อสอบบันทึกใหม่',
    subjectName: overrides?.subjectName || config.subjectName || 'วิชาทั่วไป',
    schoolName: overrides?.schoolName || config.schoolName,
    teacherId: overrides?.teacherId || config.teacherId,
    teacherName: overrides?.teacherName || config.teacherName || 'ครูผู้สอน',
    workspaceId: overrides?.workspaceId,
    isSharedToSchool: overrides?.isSharedToSchool ?? true,
    academicYear: overrides?.academicYear || config.academicYear || '2568',
    term: overrides?.term || config.term || '1',
    roomName: overrides?.roomName || config.roomName,
    isUniversalRoom: config.isUniversalRoom !== false,
    totalQuestions: config.totalQuestions,
    choicesCount: config.choicesCount,
    choiceLabelType: config.choiceLabelType,
    layout: config.layout,
    studentIdFormat: config.studentIdFormat,
    totalScore: config.totalScore,
    themeColor: config.themeColor || 'slate',
    examSet: currentSet,
    examSets,
    answerKeys: { ...config.answerKeys },
    pointsPerQuestion: { ...config.pointsPerQuestion },
    savedAt: new Date().toISOString(),
  };

  const existingIdx = currentTemplates.findIndex((t) => t.id === templateId);
  let updatedList: ExamBankTemplate[];
  if (existingIdx >= 0) {
    updatedList = [...currentTemplates];
    updatedList[existingIdx] = newTemplate;
  } else {
    updatedList = [newTemplate, ...currentTemplates];
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
  } catch (e) {
    console.error('[ExamBank] Failed to persist template:', e);
  }
  return newTemplate;
}

/**
 * Delete a template from LocalStorage AND Supabase Cloud.
 */
export async function deleteCloudExamTemplate(
  id: string,
  session?: AppSessionContext | null
): Promise<ExamBankTemplate[]> {
  const current = getExamBankTemplates();
  const filtered = current.filter((t) => t.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error('[ExamBank] Failed to save after delete:', e);
  }

  if (isSupabaseReady && supabase) {
    // Delete from table
    try {
      await supabase.from('omr_exam_templates').delete().eq('id', id);
    } catch {
      // ignore
    }

    // Delete from profile metadata
    const profileId = session?.profile?.id;
    if (profileId) {
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('metadata')
          .eq('id', profileId)
          .maybeSingle();

        const currentMeta = (prof?.metadata as Record<string, any>) || {};
        if (Array.isArray(currentMeta.omr_exam_bank)) {
          const nextMetaBank = currentMeta.omr_exam_bank.filter((m: ExamBankTemplate) => m.id !== id);
          await supabase
            .from('profiles')
            .update({
              metadata: {
                ...currentMeta,
                omr_exam_bank: nextMetaBank,
              },
            })
            .eq('id', profileId);
        }
      } catch {
        // ignore
      }
    }
  }

  return filtered;
}

export function deleteExamBankTemplate(
  id: string,
  session?: AppSessionContext | null
): ExamBankTemplate[] {
  deleteCloudExamTemplate(id, session).catch(() => {});
  const current = getExamBankTemplates();
  const filtered = current.filter((t) => t.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error('[ExamBank] Failed to save after delete:', e);
  }
  return filtered;
}

export function toggleShareExamBankTemplate(id: string): ExamBankTemplate[] {
  const current = getExamBankTemplates();
  const updated = current.map((item) => {
    if (item.id === id) {
      return { ...item, isSharedToSchool: !item.isSharedToSchool };
    }
    return item;
  });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('[ExamBank] Failed to update share status:', e);
  }
  return updated;
}

/**
 * Save the teacher's active OMR draft to cloud so when they switch to mobile phone,
 * the mobile phone automatically loads the exact same exam draft.
 */
export async function saveCloudActiveDraft(
  config: AnswerSheetConfig,
  session?: AppSessionContext | null
): Promise<void> {
  // 1. Local storage
  try {
    localStorage.setItem(STORAGE_DRAFT_KEY, JSON.stringify(config));
  } catch {
    // ignore
  }

  // 2. Cloud profile metadata
  const profileId = session?.profile?.id;
  if (!profileId || !isSupabaseReady || !supabase) return;

  try {
    const { data: prof } = await supabase
      .from('profiles')
      .select('metadata')
      .eq('id', profileId)
      .maybeSingle();

    const currentMeta = (prof?.metadata as Record<string, any>) || {};
    await supabase
      .from('profiles')
      .update({
        metadata: {
          ...currentMeta,
          omr_active_draft: config,
          omr_active_draft_updated_at: new Date().toISOString(),
        },
      })
      .eq('id', profileId);
  } catch {
    // ignore
  }
}

/**
 * Fetch the active OMR draft from Cloud.
 */
export async function fetchCloudActiveDraft(
  session?: AppSessionContext | null
): Promise<AnswerSheetConfig | null> {
  const profileId = session?.profile?.id;
  if (!profileId || !isSupabaseReady || !supabase) return null;

  try {
    const { data: prof } = await supabase
      .from('profiles')
      .select('metadata')
      .eq('id', profileId)
      .maybeSingle();

    const meta = (prof?.metadata as Record<string, any>) || {};
    if (meta.omr_active_draft && meta.omr_active_draft.answerKeys) {
      return meta.omr_active_draft as AnswerSheetConfig;
    }
  } catch {
    // ignore
  }
  return null;
}

export function exportExamBankToJson(templatesToExport?: ExamBankTemplate[]): void {
  const templates = templatesToExport || getExamBankTemplates();
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(templates, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadAnchor.setAttribute('download', `ClassCare360_ExamBank_${dateStr}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export function importExamBankFromJson(
  jsonString: string,
  teacherId?: string,
  teacherName?: string
): { success: boolean; count: number; error?: string } {
  try {
    const parsed = JSON.parse(jsonString);
    if (!Array.isArray(parsed)) {
      return { success: false, count: 0, error: 'รูปแบบไฟล์ไม่ถูกต้อง (ต้องเป็นรายการชุดข้อสอบ JSON Array)' };
    }

    const current = getExamBankTemplates();
    const existingIds = new Set(current.map((t) => t.id));
    let addedCount = 0;

    const merged = [...current];
    for (const item of parsed) {
      if (item && item.title && item.totalQuestions) {
        if (!item.id || existingIds.has(item.id)) {
          item.id = `bank_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        }
        item.savedAt = item.savedAt || new Date().toISOString();
        if (teacherId && !item.teacherId) {
          item.teacherId = teacherId;
          item.teacherName = teacherName || item.teacherName;
        }
        merged.unshift(item);
        existingIds.add(item.id);
        addedCount++;
      }
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    return { success: true, count: addedCount };
  } catch (e: any) {
    return { success: false, count: 0, error: e?.message || 'ไม่สามารถอ่านไฟล์ JSON ได้' };
  }
}
