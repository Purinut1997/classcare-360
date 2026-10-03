export type OmrRecordingMode = 'verify_first' | 'instant_auto' | 'display_only';
export type OmrStudentMode = 'classroom' | 'anonymous';
export type ChoiceLabelType = 'ABCD' | 'THAI' | 'NUMERIC';
export type AnswerSheetLayout = 'single_full' | 'eco_half';
export type StudentIdFormat = 'roll_number' | 'student_code' | 'none';

export interface AnswerSheetConfig {
  id: string;
  title: string;
  subjectName: string;
  examDate: string;
  instructions: string;
  totalQuestions: number; // 10, 20, 30, 40, 50, 60, 100
  choicesCount: 3 | 4 | 5; // e.g. 4 (A-D / ก-ง)
  choiceLabelType: ChoiceLabelType;
  layout: AnswerSheetLayout;
  studentIdFormat: StudentIdFormat; // 'roll_number' (2 digits: 01-99), 'student_code' (5 digits), or 'none' (anonymous)
  answerKeys: Record<number, string>; // { 1: 'A', 2: 'C', ... }
  pointsPerQuestion: Record<number, number>; // { 1: 1, 2: 1, ... }
  classroomId?: string | null;
  assessmentId?: string | null;
  totalScore: number;
}

export interface ScannedAnswerDetail {
  questionNumber: number;
  detectedChoice: string | null; // 'A', 'B', null (blank), 'MULTIPLE'
  correctChoice: string;
  isCorrect: boolean;
  scoreAwarded: number;
  maxScore: number;
  fillRatios: Record<string, number>; // fill density for each bubble option
  flag?: 'multiple' | 'blank' | 'faint' | 'ok';
}

export interface ScannedExamResult {
  id: string;
  scannedAt: string;
  studentMode: OmrStudentMode;
  studentId: string | null;
  studentRollNumber: number | null;
  studentCode: string | null;
  studentName: string;
  detectedAnswers: Record<number, string | null>;
  answersDetail: ScannedAnswerDetail[];
  totalScore: number;
  maxScore: number;
  percentage: number;
  correctCount: number;
  incorrectCount: number;
  blankCount: number;
  multipleCount: number;
  confidence: number; // 0.0 - 1.0
  status: 'confirmed' | 'pending_review' | 'flagged' | 'display_only';
  flags: string[];
  recordingMode: OmrRecordingMode;
  isSavedToGradebook: boolean;
  previewImageUrl?: string;
}

export interface ItemAnalysisStat {
  questionNumber: number;
  correctChoice: string;
  totalAttempts: number;
  correctCount: number;
  incorrectCount: number;
  blankCount: number;
  multipleCount: number;
  choiceDistribution: Record<string, number>;
  difficultyIndex: number; // 0.0 - 1.0 (Higher = easier, lower = harder)
  difficultyLabel: 'ยากมาก' | 'ค่อนข้างยาก' | 'ปานกลาง' | 'ค่อนข้างง่าย' | 'ง่ายมาก';
}
