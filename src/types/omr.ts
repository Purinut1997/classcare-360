export type OmrRecordingMode = 'verify_first' | 'instant_auto' | 'display_only';
export type OmrStudentMode = 'classroom' | 'anonymous';
export type ChoiceLabelType = 'ABCD' | 'THAI' | 'NUMERIC';
export type AnswerSheetLayout = 'single_full' | 'eco_half';
export type StudentIdFormat = 'roll_number' | 'student_code' | 'none';
export type OmrScanOrientation = 'auto' | 0 | 90 | 180 | 270;

export type AnswerSheetThemeColor = 'burgundy' | 'navy' | 'slate' | 'emerald';

export type ExamQuestionType = 'single_choice' | 'multiple_choice' | 'short_answer' | 'essay';
export type ShortAnswerStrictness = 'lenient' | 'normal' | 'strict';

export interface ExamQuestionItem {
  id: string;
  number: number;
  sectionIndex: 1 | 2 | 3 | 4;
  type: ExamQuestionType;
  prompt: string;
  choices?: string[];
  correctChoice?: string;
  correctChoices?: string[];
  acceptedTextAnswers?: string[];
  points: number;
  explanation?: string;
}

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
  themeColor?: AnswerSheetThemeColor;
  examSet?: string;
  academicYear?: string;
  term?: string;
  roomName?: string;
  schoolName?: string;
  isUniversalRoom?: boolean; // If true, answer sheet is universal across all classrooms
  showQrCode?: boolean; // If true, render machine-readable QR Code at top-right of sheet
  examSets?: Record<string, Record<number, string>>; // Answer keys mapped by exam set, e.g. { '01': {...}, '02': {...} }
  teacherId?: string; // ID of the teacher who authored the exam
  teacherName?: string; // Display name of teacher
  bonusQuestions?: Record<number, boolean>; // Questions awarded full points to everyone
  multiAnswerKeys?: Record<number, string[]>; // Questions with multiple accepted choices
  questions?: ExamQuestionItem[]; // Unified rich exam items for OMR + Mobile Exam + Live Quiz
  shortAnswerStrictness?: ShortAnswerStrictness;
  postSubmitMessage?: string;
}

export interface ExamBankTemplate {
  id: string;
  title: string;
  subjectName: string;
  schoolName?: string;
  teacherId?: string;
  teacherName?: string;
  workspaceId?: string;
  isSharedToSchool?: boolean; // True if shared with other teachers in the school/workspace
  academicYear?: string;
  term?: string;
  roomName?: string;
  isUniversalRoom?: boolean;
  totalQuestions: number;
  choicesCount: 3 | 4 | 5;
  choiceLabelType: ChoiceLabelType;
  layout: AnswerSheetLayout;
  studentIdFormat: StudentIdFormat;
  totalScore: number;
  themeColor?: AnswerSheetThemeColor;
  examSet: string;
  examSets?: Record<string, Record<number, string>>;
  answerKeys: Record<number, string>;
  pointsPerQuestion: Record<number, number>;
  bonusQuestions?: Record<number, boolean>;
  multiAnswerKeys?: Record<number, string[]>;
  questions?: ExamQuestionItem[];
  shortAnswerStrictness?: ShortAnswerStrictness;
  postSubmitMessage?: string;
  savedAt: string;
}

export interface ScannedAnswerDetail {
  questionNumber: number;
  detectedChoice: string | null; // 'A', 'B', null (blank), 'MULTIPLE'
  correctChoice: string;
  acceptedChoices?: string[];
  isBonus?: boolean;
  isCorrect: boolean;
  scoreAwarded: number;
  maxScore: number;
  fillRatios: Record<string, number>; // fill density for each bubble option
  flag?: 'multiple' | 'blank' | 'faint' | 'ok' | 'bonus';
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
  detectedOrientation?: 0 | 90 | 180 | 270;
  detectedExamSet?: string | null;
  detectedQrPayload?: Record<string, unknown> | null;
  annotatedOverlayUrl?: string;
  perspectiveCorrected?: boolean;
  usedAiFallback?: boolean;
  savedAssessmentId?: string | null;
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
