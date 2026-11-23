import { supabase } from './supabaseClient';
import type {
  AnswerSheetConfig,
  ChoiceLabelType,
  ExamQuestionItem,
  ShortAnswerStrictness,
} from '../types/omr';

export type OnlineExamMode = 'mobile_exam' | 'live_quiz';
export type OnlineExamStatus = 'lobby' | 'active' | 'revealed' | 'closed';

export interface PublicExamQuestion {
  id: string;
  number: number;
  sectionIndex: 1 | 2 | 3 | 4;
  type: ExamQuestionItem['type'];
  prompt: string;
  choices?: string[];
  points: number;
}

export interface OnlineExamPayload {
  title: string;
  subjectName: string;
  instructions: string;
  postSubmitMessage: string;
  choiceLabelType: ChoiceLabelType;
  choicesCount: 3 | 4 | 5;
  totalScore: number;
  questions: PublicExamQuestion[];
}

export interface OnlineExamSessionRecord {
  id: string;
  workspace_id: string;
  classroom_id: string | null;
  assessment_id: string | null;
  pin_code: string;
  mode: OnlineExamMode;
  status: OnlineExamStatus;
  current_question_index: number;
  title: string;
  subject_name: string;
  exam_payload: OnlineExamPayload;
  time_limit_minutes: number;
  show_score_immediately: boolean;
  created_at: string;
}

export interface OnlineExamSubmissionRecord {
  id: string;
  workspace_id: string;
  session_id: string;
  student_id: string | null;
  student_code: string | null;
  student_name: string;
  nickname: string | null;
  answers: Record<string, string | string[]>;
  flagged_questions: number[];
  score: number;
  max_score: number;
  live_points: number;
  synced_to_gradebook: boolean;
  submitted_at: string | null;
  created_at: string;
}

export interface LiveQuizLeaderboardEntry {
  submission_id: string;
  display_name: string;
  live_points: number;
  score: number;
}

export interface JoinExamResult {
  found: boolean;
  error?: string;
  session?: {
    id: string;
    pin_code: string;
    mode: OnlineExamMode;
    status: OnlineExamStatus;
    current_question_index: number;
    title: string;
    subject_name: string;
    classroom_name: string | null;
    exam_payload: OnlineExamPayload;
    time_limit_minutes: number;
    show_score_immediately: boolean;
  };
  students: Array<{
    id: string;
    student_code: string;
    first_name: string;
    last_name: string;
  }>;
}

export interface LiveQuizPublicState {
  found: boolean;
  status: OnlineExamStatus;
  mode: OnlineExamMode;
  current_question_index: number;
  participant_count: number;
  answered_count: number;
  revealed_correct: {
    number: string;
    correctChoice?: string;
    correctChoices?: string[];
    acceptedTextAnswers?: string[];
  } | null;
  leaderboard: LiveQuizLeaderboardEntry[];
}

const LOCAL_SESSIONS_KEY = 'classcare_hybrid_exam_local_sessions_v1';
const LOCAL_SUBMISSIONS_KEY = 'classcare_hybrid_exam_local_submissions_v1';
export const HYBRID_EXAM_CHANNEL_NAME = 'classcare_hybrid_exam';

const CUTE_THAI_NICKNAMES = [
  'เต่าทองตาโต',
  'กบเขียวร่าเริง',
  'เพนกวินขี้สงสัย',
  'แมวส้มสายฟ้า',
  'กระต่ายนักคิด',
  'โลมาแสนรู้',
  'แพนด้าขยันเรียน',
  'ช้างน้อยใจดี',
  'นกฮูกตื่นเช้า',
  'หมีพูห์ชิมน้ำผึ้ง',
  'สุนัขจิ้งจอกว่องไว',
  'ผีเสื้อสีรุ้ง',
  'ปลาวาฬยิ้มแฉ่ง',
  'เป็ดเหลืองลุยสอบ',
  'ลิงน้อยยอดนักคำนวณ',
  'สิงโตใจกล้า',
];

export function generateCuteThaiNickname(): string {
  const base = CUTE_THAI_NICKNAMES[Math.floor(Math.random() * CUTE_THAI_NICKNAMES.length)] || 'เพื่อนใหม่';
  return base;
}

export function getChoiceDisplayLabel(labelType: ChoiceLabelType | undefined, index: number): string {
  const thai = ['ก', 'ข', 'ค', 'ง', 'จ'];
  const abcd = ['A', 'B', 'C', 'D', 'E'];
  if (labelType === 'THAI') return thai[index] || String(index + 1);
  if (labelType === 'NUMERIC') return String(index + 1);
  return abcd[index] || String(index + 1);
}

export function normalizeChoiceKey(index: number): string {
  return ['A', 'B', 'C', 'D', 'E'][index] || 'A';
}

function normalizeAnswerText(raw: string, strictness: ShortAnswerStrictness): string {
  if (strictness === 'strict') {
    return raw.trim();
  }
  let cleaned = raw.trim().replace(/\s+/g, ' ').toLocaleLowerCase('th');
  if (strictness === 'lenient') {
    const thaiDigits = '๐๑๒๓๔๕๖๗๘๙';
    cleaned = cleaned
      .replace(/[๐-๙]/g, (ch) => String(thaiDigits.indexOf(ch)))
      .replace(/\s+/g, '');
  }
  return cleaned;
}

export function gradeExamAnswers(
  questions: ExamQuestionItem[],
  answers: Record<string, string | string[]>,
  strictness: ShortAnswerStrictness = 'normal',
): { score: number; maxScore: number; correctCount: number } {
  let score = 0;
  let maxScore = 0;
  let correctCount = 0;

  for (const q of questions) {
    const pts = Number.isFinite(q.points) && q.points > 0 ? q.points : 1;
    maxScore += pts;
    const rawAns = answers[String(q.number)];
    if (rawAns === undefined || rawAns === null) continue;

    if (q.type === 'single_choice') {
      const actual = typeof rawAns === 'string' ? rawAns.trim().toUpperCase() : '';
      const expected = (q.correctChoice || '').trim().toUpperCase();
      if (expected && actual === expected) {
        score += pts;
        correctCount += 1;
      }
    } else if (q.type === 'multiple_choice') {
      const expectedList = (q.correctChoices || [])
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean)
        .sort();
      const actualList = (Array.isArray(rawAns) ? rawAns : [String(rawAns)])
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean)
        .sort();
      if (
        expectedList.length > 0 &&
        expectedList.length === actualList.length &&
        expectedList.every((val, idx) => val === actualList[idx])
      ) {
        score += pts;
        correctCount += 1;
      }
    } else if (q.type === 'short_answer') {
      const actualStr = normalizeAnswerText(Array.isArray(rawAns) ? rawAns.join(' ') : String(rawAns), strictness);
      if (!actualStr) continue;
      const accepted = (q.acceptedTextAnswers || [])
        .map((item) => normalizeAnswerText(item, strictness))
        .filter(Boolean);
      if (accepted.includes(actualStr)) {
        score += pts;
        correctCount += 1;
      }
    }
  }

  return { score, maxScore, correctCount };
}

export function buildDefaultQuestionsFromOmrConfig(config: AnswerSheetConfig): ExamQuestionItem[] {
  if (Array.isArray(config.questions) && config.questions.length > 0) {
    return config.questions;
  }

  const count = Math.max(1, Math.min(20, Number(config.totalQuestions || 10)));
  const choicesLen = config.choicesCount || 4;
  return Array.from({ length: count }, (_, idx) => {
    const num = idx + 1;
    const key = (config.answerKeys?.[num] || normalizeChoiceKey(idx % choicesLen)).toUpperCase();
    const pts = Number(config.pointsPerQuestion?.[num] || 1);
    return {
      id: `q-${num}`,
      number: num,
      sectionIndex: 1,
      type: 'single_choice',
      prompt: `ข้อที่ ${num} (${config.subjectName || 'วิชาทั่วไป'})`,
      choices: Array.from({ length: choicesLen }, (__, cIdx) => `ตัวเลือก ${getChoiceDisplayLabel(config.choiceLabelType, cIdx)}`),
      correctChoice: key,
      points: Number.isFinite(pts) && pts > 0 ? pts : 1,
    };
  });
}

export function syncQuestionsToOmrConfig(
  config: AnswerSheetConfig,
  questions: ExamQuestionItem[],
): AnswerSheetConfig {
  const nextKeys: Record<number, string> = { ...(config.answerKeys || {}) };
  const nextPoints: Record<number, number> = { ...(config.pointsPerQuestion || {}) };
  const nextMulti: Record<number, string[]> = { ...(config.multiAnswerKeys || {}) };

  const choiceQuestions = questions.filter(
    (q) => q.type === 'single_choice' || q.type === 'multiple_choice',
  );

  let totalScore = 0;
  questions.forEach((q) => {
    const pts = Number.isFinite(q.points) && q.points > 0 ? q.points : 1;
    totalScore += pts;
    nextPoints[q.number] = pts;
    if (q.type === 'single_choice' && q.correctChoice) {
      nextKeys[q.number] = q.correctChoice.toUpperCase();
    } else if (q.type === 'multiple_choice' && q.correctChoices && q.correctChoices.length > 0) {
      nextKeys[q.number] = q.correctChoices[0].toUpperCase();
      nextMulti[q.number] = q.correctChoices.map((c) => c.toUpperCase());
    }
  });

  const omrQuestionCount = Math.max(config.totalQuestions || 10, choiceQuestions.length);

  return {
    ...config,
    questions,
    totalQuestions: omrQuestionCount,
    totalScore: Math.max(1, totalScore),
    answerKeys: nextKeys,
    pointsPerQuestion: nextPoints,
    multiAnswerKeys: nextMulti,
  };
}

function buildPublicAndKeyPayloads(config: AnswerSheetConfig, questions: ExamQuestionItem[]) {
  const publicQuestions: PublicExamQuestion[] = questions.map((q) => ({
    id: q.id,
    number: q.number,
    sectionIndex: q.sectionIndex,
    type: q.type,
    prompt: q.prompt,
    choices: q.choices,
    points: q.points,
  }));

  const examPayload: OnlineExamPayload = {
    title: config.title || 'แบบทดสอบ',
    subjectName: config.subjectName || 'วิชาทั่วไป',
    instructions: config.instructions || 'เลือกคำตอบที่ถูกต้องที่สุด',
    postSubmitMessage: config.postSubmitMessage || 'ส่งคำตอบเรียบร้อยแล้ว ขอบคุณที่ตั้งใจทำแบบทดสอบ!',
    choiceLabelType: config.choiceLabelType || 'THAI',
    choicesCount: config.choicesCount || 4,
    totalScore: questions.reduce((s, q) => s + (q.points || 1), 0),
    questions: publicQuestions,
  };

  const answerKeyPayload = {
    strictness: config.shortAnswerStrictness || 'normal',
    questions: questions.map((q) => ({
      number: q.number,
      type: q.type,
      points: q.points || 1,
      correctChoice: q.correctChoice || '',
      correctChoices: q.correctChoices || [],
      acceptedTextAnswers: q.acceptedTextAnswers || [],
    })),
  };

  return { examPayload, answerKeyPayload };
}

function generateSixDigitPin(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return String(100000 + (arr[0] % 900000));
  }
  return String(Math.floor(100000 + Math.random() * 900000));
}

function broadcastExamEvent(pin: string) {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel(HYBRID_EXAM_CHANNEL_NAME);
      ch.postMessage({ type: 'sync', pin });
      ch.close();
    }
  } catch {
    // Ignore unsupported BroadcastChannel environments
  }
}

interface LocalStoredSession extends OnlineExamSessionRecord {
  answer_key_payload: {
    strictness: ShortAnswerStrictness;
    questions: Array<{
      number: number;
      type: ExamQuestionItem['type'];
      points: number;
      correctChoice?: string;
      correctChoices?: string[];
      acceptedTextAnswers?: string[];
    }>;
  };
  classroom_name?: string | null;
  students?: Array<{ id: string; student_code: string; first_name: string; last_name: string }>;
}

function readLocalSessions(): Record<string, LocalStoredSession> {
  try {
    const raw = window.localStorage.getItem(LOCAL_SESSIONS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, LocalStoredSession>) : {};
  } catch {
    return {};
  }
}

function writeLocalSessions(map: Record<string, LocalStoredSession>) {
  try {
    window.localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(map));
  } catch {
    // Ignore quota errors
  }
}

function readLocalSubmissions(): Record<string, OnlineExamSubmissionRecord[]> {
  try {
    const raw = window.localStorage.getItem(LOCAL_SUBMISSIONS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, OnlineExamSubmissionRecord[]>) : {};
  } catch {
    return {};
  }
}

function writeLocalSubmissions(map: Record<string, OnlineExamSubmissionRecord[]>) {
  try {
    window.localStorage.setItem(LOCAL_SUBMISSIONS_KEY, JSON.stringify(map));
  } catch {
    // Ignore quota errors
  }
}

function shouldFallbackToLocal(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = error.message || '';
  return (
    error.code === '42P01' ||
    error.code === 'PGRST202' ||
    error.code === 'PGRST205' ||
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('Could not find') ||
    msg.includes('Failed to fetch')
  );
}

export async function createOnlineExamSession(params: {
  workspaceId: string;
  classroomId?: string | null;
  classroomName?: string | null;
  assessmentId?: string | null;
  createdBy?: string | null;
  mode: OnlineExamMode;
  config: AnswerSheetConfig;
  questions: ExamQuestionItem[];
  students?: Array<{ id: string; student_code: string; first_name: string; last_name: string }>;
  isDemo?: boolean;
  timeLimitMinutes?: number;
  showScoreImmediately?: boolean;
}): Promise<{ session: OnlineExamSessionRecord | null; error?: string; isLocalFallback?: boolean }> {
  const pinCode = generateSixDigitPin();
  const { examPayload, answerKeyPayload } = buildPublicAndKeyPayloads(params.config, params.questions);
  const nowIso = new Date().toISOString();

  const localFallbackSession: LocalStoredSession = {
    id: `local-exam-${Date.now()}`,
    workspace_id: params.workspaceId || 'demo',
    classroom_id: params.classroomId || null,
    classroom_name: params.classroomName || null,
    assessment_id: params.assessmentId || null,
    pin_code: pinCode,
    mode: params.mode,
    status: params.mode === 'live_quiz' ? 'lobby' : 'active',
    current_question_index: 0,
    title: params.config.title || 'แบบทดสอบ',
    subject_name: params.config.subjectName || 'วิชาทั่วไป',
    exam_payload: examPayload,
    answer_key_payload: answerKeyPayload,
    time_limit_minutes: params.timeLimitMinutes ?? 0,
    show_score_immediately: params.showScoreImmediately ?? true,
    created_at: nowIso,
    students: params.students || [],
  };

  if (params.isDemo || !supabase || !params.workspaceId) {
    const sessions = readLocalSessions();
    sessions[pinCode] = localFallbackSession;
    writeLocalSessions(sessions);
    broadcastExamEvent(pinCode);
    return { session: localFallbackSession, isLocalFallback: true };
  }

  try {
    const { data, error } = await supabase
      .from('online_exam_sessions')
      .insert({
        workspace_id: params.workspaceId,
        classroom_id: params.classroomId || null,
        assessment_id: params.assessmentId || null,
        pin_code: pinCode,
        mode: params.mode,
        status: params.mode === 'live_quiz' ? 'lobby' : 'active',
        current_question_index: 0,
        title: params.config.title || 'แบบทดสอบ',
        subject_name: params.config.subjectName || 'วิชาทั่วไป',
        exam_payload: examPayload,
        answer_key_payload: answerKeyPayload,
        time_limit_minutes: params.timeLimitMinutes ?? 0,
        show_score_immediately: params.showScoreImmediately ?? true,
        created_by: params.createdBy || null,
      })
      .select(
        'id, workspace_id, classroom_id, assessment_id, pin_code, mode, status, current_question_index, title, subject_name, exam_payload, time_limit_minutes, show_score_immediately, created_at',
      )
      .single();

    if (error || !data) {
      if (shouldFallbackToLocal(error)) {
        const sessions = readLocalSessions();
        sessions[pinCode] = localFallbackSession;
        writeLocalSessions(sessions);
        broadcastExamEvent(pinCode);
        return { session: localFallbackSession, isLocalFallback: true };
      }
      return { session: null, error: error?.message || 'ไม่สามารถสร้างห้องสอบได้' };
    }

    return { session: data as OnlineExamSessionRecord };
  } catch (err) {
    const sessions = readLocalSessions();
    sessions[pinCode] = localFallbackSession;
    writeLocalSessions(sessions);
    broadcastExamEvent(pinCode);
    return {
      session: localFallbackSession,
      isLocalFallback: true,
      error: err instanceof Error ? err.message : undefined,
    };
  }
}

export async function updateOnlineExamSessionState(params: {
  sessionId: string;
  workspaceId: string;
  pinCode: string;
  status?: OnlineExamStatus;
  currentQuestionIndex?: number;
  isLocalFallback?: boolean;
}): Promise<void> {
  const localSessions = readLocalSessions();
  if (localSessions[params.pinCode]) {
    localSessions[params.pinCode] = {
      ...localSessions[params.pinCode],
      ...(params.status ? { status: params.status } : {}),
      ...(typeof params.currentQuestionIndex === 'number'
        ? { current_question_index: params.currentQuestionIndex }
        : {}),
    };
    writeLocalSessions(localSessions);
    broadcastExamEvent(params.pinCode);
  }

  if (params.isLocalFallback || !supabase || !params.workspaceId) return;

  const patch: Record<string, unknown> = {};
  if (params.status) patch.status = params.status;
  if (typeof params.currentQuestionIndex === 'number') {
    patch.current_question_index = params.currentQuestionIndex;
  }
  if (Object.keys(patch).length === 0) return;

  await supabase
    .from('online_exam_sessions')
    .update(patch)
    .eq('workspace_id', params.workspaceId)
    .eq('id', params.sessionId);

  broadcastExamEvent(params.pinCode);
}

export async function fetchOnlineExamSubmissions(params: {
  sessionId: string;
  workspaceId: string;
  pinCode: string;
  isLocalFallback?: boolean;
}): Promise<OnlineExamSubmissionRecord[]> {
  if (params.isLocalFallback || !supabase || !params.workspaceId) {
    const subs = readLocalSubmissions();
    return [...(subs[params.pinCode] || [])].sort(
      (a, b) => b.live_points - a.live_points || b.score - a.score,
    );
  }

  const { data, error } = await supabase
    .from('online_exam_submissions')
    .select(
      'id, workspace_id, session_id, student_id, student_code, student_name, nickname, answers, flagged_questions, score, max_score, live_points, synced_to_gradebook, submitted_at, created_at',
    )
    .eq('workspace_id', params.workspaceId)
    .eq('session_id', params.sessionId)
    .order('live_points', { ascending: false })
    .order('score', { ascending: false });

  if (error || !data) {
    const subs = readLocalSubmissions();
    return subs[params.pinCode] || [];
  }
  return data as OnlineExamSubmissionRecord[];
}

export async function markSubmissionsSynced(params: {
  workspaceId: string;
  sessionId: string;
  pinCode: string;
  submissionIds: string[];
  isLocalFallback?: boolean;
}): Promise<void> {
  const subs = readLocalSubmissions();
  if (subs[params.pinCode]) {
    const idSet = new Set(params.submissionIds);
    subs[params.pinCode] = subs[params.pinCode].map((item) =>
      idSet.has(item.id) ? { ...item, synced_to_gradebook: true } : item,
    );
    writeLocalSubmissions(subs);
  }

  if (params.isLocalFallback || !supabase || !params.workspaceId || params.submissionIds.length === 0) {
    return;
  }

  await supabase
    .from('online_exam_submissions')
    .update({ synced_to_gradebook: true })
    .eq('workspace_id', params.workspaceId)
    .eq('session_id', params.sessionId)
    .in('id', params.submissionIds);
}

export async function joinOnlineExamByPin(pin: string): Promise<JoinExamResult> {
  const cleanPin = pin.trim();
  if (!cleanPin) return { found: false, error: 'กรุณากรอกรหัส PIN 6 หลัก', students: [] };

  const localSessions = readLocalSessions();
  const localSess = localSessions[cleanPin];

  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('join_online_exam_by_pin', { p_pin: cleanPin });
      if (!error && data && typeof data === 'object') {
        const res = data as JoinExamResult;
        if (res.found) return res;
        if (!localSess) return { ...res, students: res.students || [] };
      } else if (error && !shouldFallbackToLocal(error) && !localSess) {
        return { found: false, error: error.message, students: [] };
      }
    } catch {
      // Fallback to local session when offline
    }
  }

  if (!localSess) {
    return { found: false, error: 'ไม่พบห้องสอบจากรหัส PIN นี้ (หรือห้องสอบถูกปิดไปแล้ว)', students: [] };
  }
  if (localSess.status === 'closed') {
    return { found: false, error: 'ห้องสอบนี้ปิดรับคำตอบแล้ว', students: [] };
  }

  return {
    found: true,
    session: {
      id: localSess.id,
      pin_code: localSess.pin_code,
      mode: localSess.mode,
      status: localSess.status,
      current_question_index: localSess.current_question_index,
      title: localSess.title,
      subject_name: localSess.subject_name,
      classroom_name: localSess.classroom_name || null,
      exam_payload: localSess.exam_payload,
      time_limit_minutes: localSess.time_limit_minutes,
      show_score_immediately: localSess.show_score_immediately,
    },
    students: localSess.students || [],
  };
}

export async function submitOnlineExamAttempt(params: {
  pin: string;
  studentName: string;
  studentCode?: string | null;
  studentId?: string | null;
  nickname?: string | null;
  answers: Record<string, string | string[]>;
  flaggedQuestions: number[];
  livePoints?: number;
  finalize?: boolean;
}): Promise<{
  submissionId: string;
  score: number | null;
  maxScore: number;
  livePoints: number;
  leaderboard: LiveQuizLeaderboardEntry[];
}> {
  const cleanPin = params.pin.trim();
  const localSessions = readLocalSessions();
  const localSess = localSessions[cleanPin];

  if (supabase && !localSess) {
    try {
      const { data, error } = await supabase.rpc('submit_online_exam_attempt', {
        p_pin: cleanPin,
        p_student_name: params.studentName.trim(),
        p_student_code: params.studentCode || null,
        p_student_id: params.studentId || null,
        p_nickname: params.nickname || null,
        p_answers: params.answers,
        p_flagged: params.flaggedQuestions,
        p_live_points: params.livePoints || 0,
        p_finalize: params.finalize ?? true,
      });
      if (!error && data && typeof data === 'object') {
        const res = data as {
          submission_id: string;
          score: number | null;
          max_score: number;
          live_points: number;
          leaderboard: LiveQuizLeaderboardEntry[];
        };
        broadcastExamEvent(cleanPin);
        return {
          submissionId: res.submission_id,
          score: res.score,
          maxScore: Number(res.max_score || 0),
          livePoints: Number(res.live_points || 0),
          leaderboard: res.leaderboard || [],
        };
      }
    } catch {
      // Fallback below
    }
  }

  // Local grading fallback (also active in demo/local preview sessions)
  const keyQuestions: ExamQuestionItem[] = (localSess?.answer_key_payload?.questions || []).map(
    (kq, idx) => ({
      id: `k-${idx}`,
      number: kq.number,
      sectionIndex: 1,
      type: kq.type,
      prompt: '',
      points: kq.points,
      correctChoice: kq.correctChoice,
      correctChoices: kq.correctChoices,
      acceptedTextAnswers: kq.acceptedTextAnswers,
    }),
  );
  const strictness = localSess?.answer_key_payload?.strictness || 'normal';
  const graded = gradeExamAnswers(keyQuestions, params.answers, strictness);

  const allSubs = readLocalSubmissions();
  const list = allSubs[cleanPin] || [];
  const identityKey = (params.studentCode?.trim() || params.studentName.trim()).toLowerCase();
  const existingIdx = list.findIndex(
    (s) => ((s.student_code?.trim() || s.student_name.trim()).toLowerCase() === identityKey),
  );
  const nowIso = new Date().toISOString();
  const subId = existingIdx >= 0 ? list[existingIdx].id : `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const nextPoints = Math.max(
    existingIdx >= 0 ? list[existingIdx].live_points : 0,
    params.livePoints || 0,
  );

  const nextRecord: OnlineExamSubmissionRecord = {
    id: subId,
    workspace_id: localSess?.workspace_id || 'demo',
    session_id: localSess?.id || 'local',
    student_id: params.studentId || null,
    student_code: params.studentCode || null,
    student_name: params.studentName.trim(),
    nickname: params.nickname || null,
    answers: params.answers,
    flagged_questions: params.flaggedQuestions,
    score: graded.score,
    max_score: graded.maxScore,
    live_points: nextPoints,
    synced_to_gradebook: existingIdx >= 0 ? list[existingIdx].synced_to_gradebook : false,
    submitted_at: params.finalize !== false ? nowIso : existingIdx >= 0 ? list[existingIdx].submitted_at : null,
    created_at: existingIdx >= 0 ? list[existingIdx].created_at : nowIso,
  };

  if (existingIdx >= 0) list[existingIdx] = nextRecord;
  else list.push(nextRecord);
  allSubs[cleanPin] = list;
  writeLocalSubmissions(allSubs);
  broadcastExamEvent(cleanPin);

  const leaderboard: LiveQuizLeaderboardEntry[] = [...list]
    .sort((a, b) => b.live_points - a.live_points || b.score - a.score)
    .slice(0, 10)
    .map((s) => ({
      submission_id: s.id,
      display_name: s.nickname || s.student_name,
      live_points: s.live_points,
      score: s.score,
    }));

  return {
    submissionId: subId,
    score: localSess?.show_score_immediately === false ? null : graded.score,
    maxScore: graded.maxScore,
    livePoints: nextPoints,
    leaderboard,
  };
}

export async function getLiveQuizPublicState(pin: string): Promise<LiveQuizPublicState> {
  const cleanPin = pin.trim();
  const localSessions = readLocalSessions();
  const localSess = localSessions[cleanPin];

  if (supabase && !localSess) {
    try {
      const { data, error } = await supabase.rpc('get_live_quiz_public_state', { p_pin: cleanPin });
      if (!error && data && typeof data === 'object') {
        return data as LiveQuizPublicState;
      }
    } catch {
      // Fallback below
    }
  }

  if (!localSess) {
    return {
      found: false,
      status: 'closed',
      mode: 'live_quiz',
      current_question_index: 0,
      participant_count: 0,
      answered_count: 0,
      revealed_correct: null,
      leaderboard: [],
    };
  }

  const allSubs = readLocalSubmissions();
  const list = allSubs[cleanPin] || [];
  const qItem = localSess.exam_payload.questions[localSess.current_question_index];
  const qKey = qItem ? String(qItem.number) : '';
  const answeredCount = qKey ? list.filter((s) => s.answers[qKey] !== undefined).length : 0;

  let revealedCorrect: LiveQuizPublicState['revealed_correct'] = null;
  if (localSess.status === 'revealed' && qKey) {
    const matchKey = localSess.answer_key_payload.questions.find((k) => String(k.number) === qKey);
    if (matchKey) {
      revealedCorrect = {
        number: qKey,
        correctChoice: matchKey.correctChoice,
        correctChoices: matchKey.correctChoices,
        acceptedTextAnswers: matchKey.acceptedTextAnswers,
      };
    }
  }

  const leaderboard: LiveQuizLeaderboardEntry[] = [...list]
    .sort((a, b) => b.live_points - a.live_points || b.score - a.score)
    .slice(0, 10)
    .map((s) => ({
      submission_id: s.id,
      display_name: s.nickname || s.student_name,
      live_points: s.live_points,
      score: s.score,
    }));

  return {
    found: true,
    status: localSess.status,
    mode: localSess.mode,
    current_question_index: localSess.current_question_index,
    participant_count: list.length,
    answered_count: answeredCount,
    revealed_correct: revealedCorrect,
    leaderboard,
  };
}
