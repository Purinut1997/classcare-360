import type { AnswerSheetConfig, ExamBankTemplate } from '../types/omr';

const STORAGE_KEY = 'classcare_omr_exam_bank';

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

export function saveExamBankTemplate(
  config: AnswerSheetConfig,
  overrides?: Partial<ExamBankTemplate>
): ExamBankTemplate {
  const currentTemplates = getExamBankTemplates();
  const templateId = overrides?.id || `bank_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  // Ensure examSets contains current set's keys
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

export function deleteExamBankTemplate(id: string): ExamBankTemplate[] {
  const current = getExamBankTemplates();
  const filtered = current.filter((t) => t.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error('[ExamBank] Failed to save after delete:', e);
  }
  return filtered;
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
