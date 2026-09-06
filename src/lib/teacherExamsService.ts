import { supabase, isSupabaseReady } from './supabaseClient';
import type { SemesterExamResult } from './aiVisionService';

export interface SavedTeacherExam {
  id: string;
  workspace_id: string;
  teacher_id?: string;
  title: string;
  subject: string;
  grade_level: string;
  term: string;
  academic_year: string;
  exam_type: string;
  total_score: number;
  multiple_choice_count: number;
  subjective_count: number;
  indicator_summary?: string;
  exam_data: SemesterExamResult;
  created_at: string;
  updated_at?: string;
}

export interface SaveTeacherExamInput {
  workspaceId: string;
  teacherId?: string;
  title: string;
  subject: string;
  gradeLevel: string;
  term?: string;
  academicYear?: string;
  examType?: string;
  totalScore?: number;
  multipleChoiceCount?: number;
  subjectiveCount?: number;
  indicatorSummary?: string;
  examData: SemesterExamResult;
}

const LOCAL_STORAGE_KEY_PREFIX = 'classcare_teacher_exams_';
const MAX_SAVED_EXAMS = 10;

/**
 * Fetch the 10 most recent exams for the given workspace.
 */
export async function fetchRecentTeacherExams(workspaceId: string): Promise<SavedTeacherExam[]> {
  if (!workspaceId) return [];

  if (isSupabaseReady && supabase) {
    try {
      const { data, error } = await supabase
        .from('teacher_exams')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(MAX_SAVED_EXAMS);

      if (!error && data) {
        // Also update local cache for offline reliability
        try {
          localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${workspaceId}`, JSON.stringify(data));
        } catch {
          // ignore storage quota error
        }
        return data as SavedTeacherExam[];
      }
      console.warn('[teacherExamsService] Supabase fetch error, fallback to local storage:', error?.message);
    } catch (e) {
      console.warn('[teacherExamsService] Supabase exception, fallback to local storage:', e);
    }
  }

  // Fallback to localStorage
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${workspaceId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.slice(0, MAX_SAVED_EXAMS);
      }
    }
  } catch {
    // ignore
  }

  return [];
}

/**
 * Save a generated exam to the workspace history (capped at 10 items).
 */
export async function saveTeacherExam(input: SaveTeacherExamInput): Promise<SavedTeacherExam> {
  const {
    workspaceId,
    teacherId,
    title,
    subject,
    gradeLevel,
    term = '1',
    academicYear = '2568',
    examType = 'midterm',
    totalScore = 20,
    multipleChoiceCount = 20,
    subjectiveCount = 0,
    indicatorSummary = '',
    examData,
  } = input;

  const newExamRecord: SavedTeacherExam = {
    id: crypto.randomUUID ? crypto.randomUUID() : `exam_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    workspace_id: workspaceId,
    teacher_id: teacherId,
    title,
    subject,
    grade_level: gradeLevel,
    term,
    academic_year: academicYear,
    exam_type: examType,
    total_score: totalScore,
    multiple_choice_count: multipleChoiceCount,
    subjective_count: subjectiveCount,
    indicator_summary: indicatorSummary,
    exam_data: examData,
    created_at: new Date().toISOString(),
  };

  if (isSupabaseReady && supabase) {
    try {
      const { data, error } = await supabase
        .from('teacher_exams')
        .insert({
          workspace_id: workspaceId,
          teacher_id: teacherId,
          title,
          subject,
          grade_level: gradeLevel,
          term,
          academic_year: academicYear,
          exam_type: examType,
          total_score: totalScore,
          multiple_choice_count: multipleChoiceCount,
          subjective_count: subjectiveCount,
          indicator_summary: indicatorSummary,
          exam_data: examData,
        })
        .select()
        .single();

      if (!error && data) {
        // Enforce FIFO limit on local cache too
        updateLocalExamsCache(workspaceId, data as SavedTeacherExam);
        return data as SavedTeacherExam;
      }
      console.warn('[teacherExamsService] Supabase insert error, fallback to local storage:', error?.message);
    } catch (e) {
      console.warn('[teacherExamsService] Supabase insert exception:', e);
    }
  }

  // Fallback save in localStorage
  updateLocalExamsCache(workspaceId, newExamRecord);
  return newExamRecord;
}

/**
 * Delete an exam from history.
 */
export async function deleteTeacherExam(id: string, workspaceId: string): Promise<boolean> {
  let success = false;
  if (isSupabaseReady && supabase) {
    try {
      const { error } = await supabase.from('teacher_exams').delete().eq('id', id);
      if (!error) success = true;
    } catch (e) {
      console.warn('[teacherExamsService] Delete exception:', e);
    }
  }

  // Update local cache
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${workspaceId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((item: SavedTeacherExam) => item.id !== id);
        localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${workspaceId}`, JSON.stringify(filtered));
        success = true;
      }
    }
  } catch {
    // ignore
  }

  return success;
}

function updateLocalExamsCache(workspaceId: string, newRecord: SavedTeacherExam) {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${workspaceId}`);
    let list: SavedTeacherExam[] = [];
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        list = parsed;
      }
    }
    // Prepend new record, deduplicate by id, and cap at 10 items
    list = [newRecord, ...list.filter((x) => x.id !== newRecord.id)].slice(0, MAX_SAVED_EXAMS);
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${workspaceId}`, JSON.stringify(list));
  } catch {
    // ignore
  }
}
