import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Award,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  DatabaseZap,
  ExternalLink,
  Maximize2,
  Minimize2,
  MonitorPlay,
  Play,
  Plus,
  QrCode,
  RefreshCw,
  Smartphone,
  StopCircle,
  Trophy,
  Users,
} from 'lucide-react';
import QRCode from 'qrcode';
import { isDemoSession } from '../../lib/auth';
import {
  HYBRID_EXAM_CHANNEL_NAME,
  buildDefaultQuestionsFromOmrConfig,
  createOnlineExamSession,
  fetchOnlineExamSubmissions,
  getChoiceDisplayLabel,
  getLiveQuizPublicState,
  markSubmissionsSynced,
  normalizeChoiceKey,
  updateOnlineExamSessionState,
  type OnlineExamMode,
  type OnlineExamSessionRecord,
  type OnlineExamSubmissionRecord,
} from '../../lib/hybridExamService';
import type { AppSessionContext } from '../../types/core';
import type { AnswerSheetConfig } from '../../types/omr';
import type { OmrAssessmentOption } from './OmrScanner';

interface LiveQuizHostPanelProps {
  config: AnswerSheetConfig;
  session: AppSessionContext | null;
  classrooms: Array<{ id: string; name: string }>;
  activeClassroomId: string;
  onSelectClassroom: (id: string) => void;
  studentsInActiveRoom: Array<{ id: string; student_code: string; first_name: string; last_name: string }>;
  assessments: OmrAssessmentOption[];
  selectedAssessmentId: string | null;
  onSelectAssessment: (id: string | null) => void;
  onCreateAssessment: (params: { title: string; subjectName: string; maxScore: number }) => Promise<string | null>;
  onBatchSaveScores: (
    entries: Array<{ studentId: string; score: number; note: string }>,
    assessmentId: string,
  ) => Promise<boolean>;
  preferredMode?: OnlineExamMode;
  onGoToStudio: () => void;
}

const OPTION_COLORS = [
  'bg-emerald-600 border-emerald-400 text-white',
  'bg-rose-600 border-rose-400 text-white',
  'bg-amber-500 border-amber-300 text-slate-950',
  'bg-sky-600 border-sky-400 text-white',
  'bg-violet-600 border-violet-400 text-white',
];

export function LiveQuizHostPanel({
  config,
  session,
  classrooms,
  activeClassroomId,
  onSelectClassroom,
  studentsInActiveRoom,
  assessments,
  selectedAssessmentId,
  onSelectAssessment,
  onCreateAssessment,
  onBatchSaveScores,
  preferredMode = 'mobile_exam',
  onGoToStudio,
}: LiveQuizHostPanelProps) {
  const [launchMode, setLaunchMode] = useState<OnlineExamMode>(preferredMode);
  const [activeSession, setActiveSession] = useState<OnlineExamSessionRecord | null>(null);
  const [isLocalFallback, setIsLocalFallback] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copiedPin, setCopiedPin] = useState(false);
  const [submissions, setSubmissions] = useState<OnlineExamSubmissionRecord[]>([]);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [countdownSec, setCountdownSec] = useState(25);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSyncingScores, setIsSyncingScores] = useState(false);
  const [isCreatingAssess, setIsCreatingAssess] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLaunchMode(preferredMode);
  }, [preferredMode]);

  const authoredQuestions = useMemo(
    () => buildDefaultQuestionsFromOmrConfig(config),
    [config],
  );

  const examPortalUrl = activeSession
    ? `${window.location.origin}/exam/${activeSession.pin_code}`
    : '';

  // Generate scannable QR whenever activeSession changes
  useEffect(() => {
    if (!examPortalUrl) {
      setQrDataUrl('');
      return;
    }
    void QRCode.toDataURL(examPortalUrl, {
      width: 280,
      margin: 2,
      color: { dark: '#1c342b', light: '#ffffff' },
    })
      .then(setQrDataUrl)
      .catch(() => {});
  }, [examPortalUrl]);

  // Poll live submissions + public answered count + listen to BroadcastChannel
  useEffect(() => {
    if (!activeSession) return;
    let active = true;

    const refresh = async () => {
      const [subs, pubState] = await Promise.all([
        fetchOnlineExamSubmissions({
          sessionId: activeSession.id,
          workspaceId: session?.workspace?.id || '',
          pinCode: activeSession.pin_code,
          isLocalFallback,
        }),
        getLiveQuizPublicState(activeSession.pin_code),
      ]);
      if (!active) return;
      setSubmissions(subs);
      if (pubState.found) {
        setAnsweredCount(pubState.answered_count);
      }
    };

    void refresh();
    const timer = window.setInterval(() => void refresh(), 2500);

    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel(HYBRID_EXAM_CHANNEL_NAME);
        channel.onmessage = (ev) => {
          if (ev.data?.pin === activeSession.pin_code) {
            void refresh();
          }
        };
      }
    } catch {
      // Ignore BroadcastChannel unavailability
    }

    return () => {
      active = false;
      window.clearInterval(timer);
      channel?.close();
    };
  }, [activeSession, isLocalFallback, session?.workspace?.id]);

  // Countdown tick during live quiz 'active' question
  useEffect(() => {
    if (!activeSession || activeSession.mode !== 'live_quiz' || activeSession.status !== 'active') {
      return;
    }
    setCountdownSec(25);
    const timer = window.setInterval(() => {
      setCountdownSec((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeSession?.id, activeSession?.mode, activeSession?.status, activeSession?.current_question_index]);

  const handleLaunchSession = async (targetMode: OnlineExamMode = launchMode) => {
    setIsLaunching(true);
    setToastMsg(null);
    const activeRoom = classrooms.find((c) => c.id === activeClassroomId);
    try {
      const res = await createOnlineExamSession({
        workspaceId: session?.workspace?.id || '',
        classroomId: activeClassroomId || null,
        classroomName: activeRoom?.name || null,
        assessmentId: selectedAssessmentId || null,
        createdBy: session?.profile?.id || null,
        mode: targetMode,
        config,
        questions: authoredQuestions,
        students: studentsInActiveRoom,
        isDemo: Boolean(session && isDemoSession(session)),
        showScoreImmediately: true,
      });

      if (res.session) {
        setActiveSession(res.session);
        setIsLocalFallback(Boolean(res.isLocalFallback));
        setSubmissions([]);
      } else {
        setToastMsg(res.error || 'ไม่สามารถเปิดห้องสอบได้');
      }
    } finally {
      setIsLaunching(false);
    }
  };

  const handleUpdateState = async (patch: {
    status?: OnlineExamSessionRecord['status'];
    currentQuestionIndex?: number;
  }) => {
    if (!activeSession) return;
    const nextSession: OnlineExamSessionRecord = {
      ...activeSession,
      ...(patch.status ? { status: patch.status } : {}),
      ...(typeof patch.currentQuestionIndex === 'number'
        ? { current_question_index: patch.currentQuestionIndex }
        : {}),
    };
    setActiveSession(nextSession);
    await updateOnlineExamSessionState({
      sessionId: activeSession.id,
      workspaceId: session?.workspace?.id || '',
      pinCode: activeSession.pin_code,
      status: patch.status,
      currentQuestionIndex: patch.currentQuestionIndex,
      isLocalFallback,
    });
  };

  const handleQuickCreateAssessment = async () => {
    setIsCreatingAssess(true);
    try {
      const totalPts = authoredQuestions.reduce((s, q) => s + (q.points || 1), 0);
      await onCreateAssessment({
        title: config.title || 'แบบทดสอบออนไลน์',
        subjectName: config.subjectName || 'วิชาทั่วไป',
        maxScore: Math.max(1, totalPts),
      });
    } finally {
      setIsCreatingAssess(false);
    }
  };

  const handleSyncToGradebook = async () => {
    if (!activeSession) return;
    let targetAssessmentId = selectedAssessmentId;
    if (!targetAssessmentId) {
      const created = await onCreateAssessment({
        title: config.title || 'แบบทดสอบออนไลน์',
        subjectName: config.subjectName || 'วิชาทั่วไป',
        maxScore: Math.max(1, authoredQuestions.reduce((s, q) => s + (q.points || 1), 0)),
      });
      if (!created) return;
      targetAssessmentId = created;
    }

    const matched = submissions
      .filter((s) => Boolean(s.student_id))
      .map((s) => ({
        studentId: s.student_id!,
        score: Number(s.score || 0),
        note:
          activeSession.mode === 'live_quiz'
            ? `ควิซสด PIN ${activeSession.pin_code}`
            : `สอบออนไลน์ PIN ${activeSession.pin_code}`,
      }));

    if (matched.length === 0) {
      setToastMsg('ยังไม่มีผู้ส่งที่จับคู่รายชื่อในห้องเรียนนี้ (ผู้สอบแบบพิมพ์ชื่อเองยังไม่ลงสมุดคะแนนอัตโนมัติ)');
      return;
    }

    setIsSyncingScores(true);
    try {
      const ok = await onBatchSaveScores(matched, targetAssessmentId);
      if (ok) {
        const syncedIds = submissions.filter((s) => Boolean(s.student_id)).map((s) => s.id);
        await markSubmissionsSynced({
          workspaceId: session?.workspace?.id || '',
          sessionId: activeSession.id,
          pinCode: activeSession.pin_code,
          submissionIds: syncedIds,
          isLocalFallback,
        });
        setSubmissions((prev) =>
          prev.map((s) => (s.student_id ? { ...s, synced_to_gradebook: true } : s)),
        );
        setToastMsg(`บันทึกคะแนนนักเรียน ${matched.length} คนลงสมุดคะแนนเรียบร้อยแล้ว!`);
      }
    } finally {
      setIsSyncingScores(false);
    }
  };

  const toggleFullscreen = () => {
    if (!stageRef.current) return;
    if (!document.fullscreenElement) {
      void stageRef.current.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      void document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  const currentQuestion = authoredQuestions[activeSession?.current_question_index || 0] || authoredQuestions[0];
  const currentKey = activeSession?.status === 'revealed' && currentQuestion ? currentQuestion.correctChoice : null;
  const maxLeaderboardPts = Math.max(1, ...submissions.map((s) => s.live_points || s.score || 0));

  return (
    <div className="space-y-4">
      {/* Control & Context Setup Card */}
      <div className="rounded-2xl border border-[#e5e8e1] bg-white p-4 shadow-2xs space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-lg font-extrabold text-[#1f2924]">
              สอบบนมือถือ & ควิซสดทั้งห้อง (ชุดข้อสอบ: {config.title})
            </h2>
            <p className="text-xs font-medium text-[#75827a]">
              ใช้ข้อสอบชุดเดียว ({authoredQuestions.length} ข้อ) เลือกได้ว่าจะให้นักเรียนทำบนมือถือหรือเปิดเล่นควิซสดหน้าจอโปรเจกเตอร์
            </p>
          </div>

          <button
            type="button"
            onClick={onGoToStudio}
            className="inline-flex h-9 items-center gap-1.5 self-start rounded-xl border border-[#dce3d7] bg-[#fafbf9] px-3 text-xs font-bold text-[#1f2924] hover:bg-[#f0f3ee]"
          >
            แก้ไขโจทย์และเฉลยในสตูดิโอ
          </button>
        </div>

        {/* Select Mode + Classroom + Assessment */}
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="block text-[11px] font-bold text-[#75827a]">เลือกรูปแบบห้องสอบ</label>
            <div className="mt-1 grid grid-cols-2 gap-1.5 rounded-xl bg-[#f1f3ef] p-1">
              <button
                type="button"
                onClick={() => setLaunchMode('mobile_exam')}
                className={`inline-flex h-8 items-center justify-center gap-1 rounded-lg text-xs font-bold transition ${
                  launchMode === 'mobile_exam'
                    ? 'bg-white text-[#1f2924] shadow-2xs'
                    : 'text-[#5b6a5f]'
                }`}
              >
                <Smartphone size={13} aria-hidden="true" />
                <span>สอบบนมือถือ</span>
              </button>
              <button
                type="button"
                onClick={() => setLaunchMode('live_quiz')}
                className={`inline-flex h-8 items-center justify-center gap-1 rounded-lg text-xs font-bold transition ${
                  launchMode === 'live_quiz'
                    ? 'bg-[#1c342b] text-white shadow-2xs'
                    : 'text-[#5b6a5f]'
                }`}
              >
                <MonitorPlay size={13} aria-hidden="true" />
                <span>ควิซสด</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#75827a]">ห้องเรียนเป้าหมาย</label>
            <select
              value={activeClassroomId}
              onChange={(e) => onSelectClassroom(e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-[#dce3d7] bg-[#fafbf9] px-3 text-xs font-bold text-[#1f2924] outline-none"
            >
              {classrooms.length === 0 ? <option value="">ห้องเรียนทั่วไป</option> : null}
              {classrooms.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#75827a]">ช่องคะแนน ปพ.5 ที่เชื่อมไว้</label>
            <div className="mt-1 flex gap-1.5">
              <select
                value={selectedAssessmentId || ''}
                onChange={(e) => onSelectAssessment(e.target.value || null)}
                className="h-10 min-w-0 flex-1 rounded-xl border border-[#dce3d7] bg-[#fafbf9] px-3 text-xs font-bold text-[#1f2924] outline-none"
              >
                <option value="">เลือกช่องคะแนนภายหลัง...</option>
                {assessments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title} (เต็ม {a.max_score})
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={isCreatingAssess}
                onClick={() => void handleQuickCreateAssessment()}
                title="สร้างช่องคะแนนใหม่ทันที"
                className="inline-flex h-10 shrink-0 items-center gap-1 rounded-xl border border-[#BFE0CD] bg-[#E6F4EC] px-2.5 text-xs font-bold text-[#1C573D]"
              >
                <Plus size={14} aria-hidden="true" />
                <span>สร้างช่อง</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#f0f2ee] pt-3">
          <div className="text-xs font-medium text-[#75827a]">
            {launchMode === 'mobile_exam'
              ? 'นักเรียนทำข้อสอบบนมือถือตามจังหวะของตัวเอง ปักธงข้อที่อยากกลับมาทวนได้ แล้วส่งเมื่อพร้อม'
              : 'เปิดจอโปรเจกเตอร์ให้ทั้งห้องเข้าด้วย PIN 6 หลัก ตอบพร้อมกันทีละข้อ แล้วขึ้นอันดับสดทันที'}
          </div>

          <button
            type="button"
            disabled={isLaunching}
            onClick={() => void handleLaunchSession(launchMode)}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#2f7d5b] px-5 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#1c573d] disabled:opacity-50"
          >
            {activeSession ? <RefreshCw size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
            <span>
              {isLaunching
                ? 'กำลังเปิดห้อง...'
                : activeSession
                  ? 'สร้าง PIN ห้องใหม่'
                  : launchMode === 'live_quiz'
                    ? 'เปิดห้องควิซสดเลย'
                    : 'เปิดลิงก์สอบบนมือถือเลย'}
            </span>
          </button>
        </div>
      </div>

      {toastMsg ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-900">
          <span>{toastMsg}</span>
          <button type="button" onClick={() => setToastMsg(null)} className="underline">
            ปิด
          </button>
        </div>
      ) : null}

      {/* Active Session Dashboard / Projector Stage */}
      {activeSession ? (
        activeSession.mode === 'live_quiz' ? (
          /* ===================== LIVE QUIZ PROJECTOR HOST ===================== */
          <div
            ref={stageRef}
            className="rounded-3xl bg-gradient-to-br from-[#1b1448] via-[#261a66] to-[#34207c] p-5 text-white shadow-xl sm:p-7"
          >
            {/* Stage Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Live Quiz · {activeSession.subject_name}
                </p>
                <h3 className="font-display text-lg font-extrabold sm:text-xl">{activeSession.title}</h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold">
                  <QrCode size={14} aria-hidden="true" />
                  PIN: <strong className="font-mono text-sm tracking-widest text-amber-300">{activeSession.pin_code}</strong>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold">
                  <Users size={14} aria-hidden="true" />
                  <span>{submissions.length} คนในห้อง</span>
                </span>
                <a
                  href={examPortalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold hover:bg-white/25"
                  title="เปิดหน้าจอฝั่งนักเรียนในแท็บใหม่เพื่อทดสอบ"
                >
                  <ExternalLink size={13} aria-hidden="true" />
                  <span>ทดสอบหน้าเด็ก</span>
                </a>
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="grid h-8 w-8 place-items-center rounded-full bg-white/15 hover:bg-white/25"
                  title={isFullscreen ? 'ออกจากเต็มจอ' : 'ขยายเต็มจอโปรเจกเตอร์'}
                >
                  {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                </button>
              </div>
            </div>

            {/* Stage Body by Status */}
            {activeSession.status === 'lobby' && (
              <div className="mt-6 grid gap-6 md:grid-cols-12 md:items-center">
                <div className="flex flex-col items-center rounded-2xl bg-white/10 p-5 text-center md:col-span-5">
                  <p className="text-xs font-bold text-indigo-200">เข้าเล่นบนมือถือที่ /exam หรือสแกน QR</p>
                  <p className="mt-2 font-mono text-4xl font-black tracking-[0.2em] text-amber-300 sm:text-5xl">
                    {activeSession.pin_code}
                  </p>
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="QR Join Live Quiz"
                      className="mt-4 h-44 w-44 rounded-2xl bg-white p-2 shadow-lg"
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(examPortalUrl);
                      setCopiedPin(true);
                      setTimeout(() => setCopiedPin(false), 2000);
                    }}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-bold hover:bg-white/25"
                  >
                    {copiedPin ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copiedPin ? 'คัดลอกลิงก์แล้ว' : 'คัดลอกลิงก์เข้าห้อง'}</span>
                  </button>
                </div>

                <div className="space-y-4 md:col-span-7">
                  <div className="flex items-center justify-between">
                    <h4 className="text-base font-extrabold">ผู้เล่นที่เข้ามาแล้ว ({submissions.length} คน)</h4>
                    <button
                      type="button"
                      onClick={() => void handleUpdateState({ status: 'active', currentQuestionIndex: 0 })}
                      className="inline-flex h-11 items-center gap-2 rounded-2xl bg-amber-400 px-6 text-sm font-black text-slate-950 shadow-lg transition hover:bg-amber-300"
                    >
                      <Play size={16} aria-hidden="true" />
                      <span>เริ่มข้อที่ 1 เลย!</span>
                    </button>
                  </div>

                  {submissions.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {submissions.map((s) => (
                        <span
                          key={s.id}
                          className="rounded-full border border-white/20 bg-white/15 px-3.5 py-1.5 text-xs font-bold animate-in zoom-in-95"
                        >
                          {s.nickname || s.student_name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/25 p-8 text-center text-sm text-indigo-200">
                      รอนักเรียนสแกน QR Code หรือกรอก PIN {activeSession.pin_code} เพื่อเข้าห้อง...
                    </div>
                  )}
                </div>
              </div>
            )}

            {(activeSession.status === 'active' || activeSession.status === 'revealed') && currentQuestion ? (
              <div className="mt-5 space-y-5">
                {/* Question Progress & Timer */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
                    ข้อ {(activeSession.current_question_index || 0) + 1} / {authoredQuestions.length}
                  </span>
                  {activeSession.status === 'active' ? (
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-3 py-1 text-xs font-black text-amber-200">
                        <Clock size={13} aria-hidden="true" />
                        {countdownSec} วินาที
                      </span>
                      <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-black text-emerald-200">
                        รับคำตอบแล้ว {answeredCount} / {Math.max(1, submissions.length)} คน
                      </span>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/25 px-3.5 py-1 text-xs font-black text-emerald-200">
                      <Trophy size={14} aria-hidden="true" />
                      อันดับหลังข้อ {(activeSession.current_question_index || 0) + 1}
                    </span>
                  )}
                </div>

                {/* Question Prompt Banner */}
                <div className="rounded-2xl bg-white p-5 text-center text-slate-900 shadow-lg">
                  <p className="text-lg font-extrabold sm:text-2xl">{currentQuestion.prompt || `ข้อที่ ${currentQuestion.number}`}</p>
                </div>

                {/* Options Grid */}
                {(currentQuestion.choices || []).length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(currentQuestion.choices || []).map((choiceText, idx) => {
                      const code = normalizeChoiceKey(idx);
                      const isCorrectOption = currentKey && currentKey.toUpperCase() === code;
                      const dimmed = Boolean(currentKey && !isCorrectOption);
                      return (
                        <div
                          key={`${currentQuestion.id}-opt-${idx}`}
                          className={`flex items-center justify-between gap-3 rounded-2xl border-2 px-4 py-4 font-extrabold shadow-md transition ${
                            OPTION_COLORS[idx % OPTION_COLORS.length]
                          } ${dimmed ? 'opacity-35' : ''} ${isCorrectOption ? 'ring-4 ring-white' : ''}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-black/25 text-sm font-black">
                              {getChoiceDisplayLabel(config.choiceLabelType, idx)}
                            </span>
                            <span className="text-base">{choiceText}</span>
                          </div>
                          {isCorrectOption ? <CheckCircle2 size={22} className="shrink-0" /> : null}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Revealed Leaderboard Card */}
                {activeSession.status === 'revealed' && (
                  <div className="rounded-2xl bg-white p-5 text-slate-900 shadow-lg">
                    <div className="flex items-center justify-between">
                      <h4 className="flex items-center gap-2 text-base font-black">
                        <Trophy size={18} className="text-amber-500" aria-hidden="true" />
                        อันดับคะแนนล่าสุด (Top 5)
                      </h4>
                    </div>
                    <div className="mt-3 space-y-2.5">
                      {submissions.slice(0, 5).map((sub, idx) => {
                        const pts = sub.live_points || Math.round(sub.score * 100);
                        const barWidth = Math.max(8, Math.round((pts / maxLeaderboardPts) * 100));
                        return (
                          <div key={sub.id} className="flex items-center gap-3">
                            <span
                              className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black ${
                                idx === 0
                                  ? 'bg-amber-100 text-amber-800'
                                  : idx === 1
                                    ? 'bg-slate-200 text-slate-700'
                                    : idx === 2
                                      ? 'bg-orange-100 text-orange-800'
                                      : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {idx + 1}
                            </span>
                            <span className="w-36 truncate text-sm font-extrabold">
                              {sub.nickname || sub.student_name}
                            </span>
                            <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  idx === 0 ? 'bg-amber-400' : idx === 1 ? 'bg-emerald-500' : 'bg-sky-500'
                                }`}
                                style={{ width: `${barWidth}%` }}
                              />
                            </div>
                            <span className="w-16 text-right font-mono text-sm font-black">{pts}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Host Controls Footer */}
                <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
                  {activeSession.status === 'active' ? (
                    <button
                      type="button"
                      onClick={() => void handleUpdateState({ status: 'revealed' })}
                      className="inline-flex h-11 items-center gap-2 rounded-2xl bg-amber-400 px-5 text-sm font-black text-slate-950 shadow-md hover:bg-amber-300"
                    >
                      <span>เฉลยตอนนี้</span>
                    </button>
                  ) : (activeSession.current_question_index || 0) + 1 < authoredQuestions.length ? (
                    <button
                      type="button"
                      onClick={() =>
                        void handleUpdateState({
                          status: 'active',
                          currentQuestionIndex: (activeSession.current_question_index || 0) + 1,
                        })
                      }
                      className="inline-flex h-11 items-center gap-2 rounded-2xl bg-emerald-400 px-5 text-sm font-black text-slate-950 shadow-md hover:bg-emerald-300"
                    >
                      <span>ไปข้อถัดไป</span>
                      <ArrowRight size={16} aria-hidden="true" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleUpdateState({ status: 'closed' })}
                      className="inline-flex h-11 items-center gap-2 rounded-2xl bg-amber-400 px-5 text-sm font-black text-slate-950 shadow-md hover:bg-amber-300"
                    >
                      <Award size={16} aria-hidden="true" />
                      <span>สรุปผล & มอบรางวัล</span>
                    </button>
                  )}
                </div>
              </div>
            ) : null}

            {activeSession.status === 'closed' && (
              <div className="mt-6 space-y-5 text-center">
                <Trophy size={48} className="mx-auto text-amber-300" aria-hidden="true" />
                <h4 className="font-display text-2xl font-black">สรุปอันดับควิซสด</h4>
                <div className="mx-auto grid max-w-2xl gap-3 sm:grid-cols-3">
                  {submissions.slice(0, 3).map((sub, idx) => (
                    <div key={sub.id} className="rounded-2xl border border-white/20 bg-white/10 p-4">
                      <p className="text-xs font-bold text-amber-300">อันดับที่ {idx + 1}</p>
                      <p className="mt-1 truncate text-base font-black">{sub.nickname || sub.student_name}</p>
                      <p className="mt-1 font-mono text-xl font-black text-emerald-300">
                        {sub.live_points || Math.round(sub.score * 100)} แต้ม
                      </p>
                      <p className="text-[11px] text-indigo-200">
                        ถูก {sub.score}/{sub.max_score} คะแนน
                      </p>
                    </div>
                  ))}
                </div>
                <div className="flex justify-center">
                  <button
                    type="button"
                    disabled={isSyncingScores}
                    onClick={() => void handleSyncToGradebook()}
                    className="inline-flex h-11 items-center gap-2 rounded-2xl bg-emerald-400 px-6 text-sm font-black text-slate-950 shadow-lg hover:bg-emerald-300 disabled:opacity-50"
                  >
                    <DatabaseZap size={16} aria-hidden="true" />
                    <span>{isSyncingScores ? 'กำลังบันทึก...' : 'นำคะแนนลงสมุดคะแนนทันที'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ===================== MOBILE EXAM HOST DASHBOARD ===================== */
          <div className="grid gap-4 lg:grid-cols-12">
            {/* Left Share Card */}
            <div className="rounded-2xl border border-[#e5e8e1] bg-white p-5 text-center shadow-2xs lg:col-span-4 space-y-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-800">
                <Smartphone size={13} aria-hidden="true" />
                {activeSession.status === 'closed' ? 'ปิดรับคำตอบแล้ว' : 'กำลังเปิดให้นักเรียนสอบบนมือถือ'}
              </span>
              <p className="font-mono text-4xl font-black tracking-[0.18em] text-[#1c342b]">
                {activeSession.pin_code}
              </p>
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="QR Mobile Exam"
                  className="mx-auto h-44 w-44 rounded-2xl border border-[#e5e8e1] p-1.5"
                />
              ) : null}
              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(examPortalUrl);
                    setCopiedPin(true);
                    setTimeout(() => setCopiedPin(false), 2000);
                  }}
                  className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-[#dce3d7] bg-[#fafbf9] text-xs font-bold text-[#1f2924] hover:bg-[#f0f3ee]"
                >
                  {copiedPin ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  <span>{copiedPin ? 'คัดลอกลิงก์แล้ว!' : 'คัดลอกลิงก์ห้องสอบ'}</span>
                </button>
                <a
                  href={examPortalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 text-xs font-bold text-sky-900 hover:bg-sky-100"
                >
                  <ExternalLink size={14} aria-hidden="true" />
                  <span>เปิดหน้าจอสอบฝั่งนักเรียน (ทดสอบ)</span>
                </a>
                {activeSession.status !== 'closed' && (
                  <button
                    type="button"
                    onClick={() => void handleUpdateState({ status: 'closed' })}
                    className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 text-xs font-bold text-rose-700 hover:bg-rose-100"
                  >
                    <StopCircle size={14} aria-hidden="true" />
                    <span>ปิดรับคำตอบ</span>
                  </button>
                )}
              </div>
            </div>

            {/* Right Live Submissions Table */}
            <div className="rounded-2xl border border-[#e5e8e1] bg-white p-5 shadow-2xs lg:col-span-8 flex flex-col justify-between">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-extrabold text-[#1f2924]">
                      นักเรียนที่ส่งคำตอบแล้ว ({submissions.length} คน)
                    </h3>
                    <p className="text-xs font-medium text-[#75827a]">
                      อัปเดตผลคะแนนอัตโนมัติทันทีที่นักเรียนกดส่งบนมือถือ
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={isSyncingScores || submissions.length === 0}
                    onClick={() => void handleSyncToGradebook()}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#2f7d5b] px-4 text-xs font-bold text-white shadow-2xs transition hover:bg-[#1c573d] disabled:opacity-45"
                  >
                    <DatabaseZap size={14} aria-hidden="true" />
                    <span>{isSyncingScores ? 'กำลังลงคะแนน...' : 'นำคะแนนลงสมุดคะแนนทันที'}</span>
                  </button>
                </div>

                {submissions.length > 0 ? (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#f0f2ee] text-[11px] font-bold text-[#75827a]">
                          <th className="py-2 pr-3">รหัส</th>
                          <th className="py-2 pr-3">ชื่อนักเรียน</th>
                          <th className="py-2 pr-3">คะแนน</th>
                          <th className="py-2 text-right">สถานะ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f0f2ee]">
                        {submissions.map((sub) => (
                          <tr key={sub.id}>
                            <td className="py-2.5 pr-3 font-mono text-[#75827a]">
                              {sub.student_code || '-'}
                            </td>
                            <td className="py-2.5 pr-3 font-bold text-[#1f2924]">{sub.student_name}</td>
                            <td className="py-2.5 pr-3 font-black text-[#1c573d]">
                              {sub.score} / {sub.max_score}
                            </td>
                            <td className="py-2.5 text-right">
                              {sub.synced_to_gradebook ? (
                                <span className="rounded-full bg-[#e6f4ec] px-2.5 py-0.5 text-[10px] font-bold text-[#1c573d]">
                                  ลง ปพ.5 แล้ว
                                </span>
                              ) : sub.submitted_at ? (
                                <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-[10px] font-bold text-sky-800">
                                  ส่งแล้ว
                                </span>
                              ) : (
                                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                                  กำลังทำ
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="mt-8 rounded-2xl border border-dashed border-[#dce3d7] bg-[#fafbf9] p-8 text-center text-xs font-medium text-[#75827a]">
                    ให้นักเรียนสแกน QR Code หรือเปิดลิงก์ด้วย PIN <strong>{activeSession.pin_code}</strong> รายชื่อและคะแนนจะปรากฏที่นี่อัตโนมัติ
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}
