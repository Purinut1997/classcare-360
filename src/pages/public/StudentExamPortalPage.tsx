import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  CheckCircle2,
  Flag,
  LayoutGrid,
  Send,
  Sparkles,
  Trophy,
  UserCheck,
  X,
} from 'lucide-react';
import {
  HYBRID_EXAM_CHANNEL_NAME,
  generateCuteThaiNickname,
  getChoiceDisplayLabel,
  getLiveQuizPublicState,
  joinOnlineExamByPin,
  normalizeChoiceKey,
  submitOnlineExamAttempt,
  type JoinExamResult,
  type LiveQuizPublicState,
} from '../../lib/hybridExamService';

const QUIZ_BTN_STYLES = [
  'bg-emerald-600 border-emerald-400 text-white active:scale-[0.98]',
  'bg-rose-600 border-rose-400 text-white active:scale-[0.98]',
  'bg-amber-500 border-amber-300 text-slate-950 active:scale-[0.98]',
  'bg-sky-600 border-sky-400 text-white active:scale-[0.98]',
  'bg-violet-600 border-violet-400 text-white active:scale-[0.98]',
];

export function StudentExamPortalPage() {
  const { pin: routePin } = useParams<{ pin?: string }>();
  const [pinInput, setPinInput] = useState(routePin || '');
  const [joinData, setJoinData] = useState<JoinExamResult | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Student identity step
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [manualName, setManualName] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [nickname, setNickname] = useState(() => generateCuteThaiNickname());
  const [studentSearch, setStudentSearch] = useState('');
  const [hasEnteredRoom, setHasEnteredRoom] = useState(false);

  // Mobile Exam state
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [flagged, setFlagged] = useState<number[]>([]);
  const [isNavigatorOpen, setIsNavigatorOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedResult, setSubmittedResult] = useState<{
    score: number | null;
    maxScore: number;
  } | null>(null);

  // Live Quiz state
  const [liveState, setLiveState] = useState<LiveQuizPublicState | null>(null);
  const [livePoints, setLivePoints] = useState(0);
  const [lastQuestionResult, setLastQuestionResult] = useState<'correct' | 'wrong' | null>(null);
  const questionShownAtRef = useRef<number>(Date.now());
  const answerSubmittedAtRef = useRef<Record<string, number>>({});
  const awardedKeysRef = useRef<Set<string>>(new Set());

  const activePin = (joinData?.session?.pin_code || pinInput).trim();

  const handleJoinPin = async (pinToTry: string) => {
    const clean = pinToTry.trim();
    if (!clean) {
      setJoinError('กรุณากรอกรหัส PIN 6 หลัก');
      return;
    }
    setIsJoining(true);
    setJoinError(null);
    try {
      const res = await joinOnlineExamByPin(clean);
      if (!res.found || !res.session) {
        setJoinError(res.error || 'ไม่พบห้องสอบนี้');
        setJoinData(null);
        return;
      }
      setJoinData(res);
    } finally {
      setIsJoining(false);
    }
  };

  useEffect(() => {
    if (routePin) {
      setPinInput(routePin);
      void handleJoinPin(routePin);
    }
  }, [routePin]);

  const selectedRosterStudent = useMemo(
    () => joinData?.students.find((s) => s.id === selectedStudentId) || null,
    [joinData?.students, selectedStudentId],
  );

  const effectiveStudentName = selectedRosterStudent
    ? `${selectedRosterStudent.first_name} ${selectedRosterStudent.last_name}`
    : manualName.trim();
  const effectiveStudentCode = selectedRosterStudent
    ? selectedRosterStudent.student_code
    : manualCode.trim();

  const filteredRoster = useMemo(() => {
    const list = joinData?.students || [];
    const q = studentSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (s) =>
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) ||
        (s.student_code || '').toLowerCase().includes(q),
    );
  }, [joinData?.students, studentSearch]);

  const handleEnterExamRoom = async () => {
    if (!effectiveStudentName || !activePin || !joinData?.session) return;
    if (joinData.session.mode === 'live_quiz') {
      await submitOnlineExamAttempt({
        pin: activePin,
        studentName: effectiveStudentName,
        studentCode: effectiveStudentCode || null,
        studentId: selectedRosterStudent?.id || null,
        nickname,
        answers: {},
        flaggedQuestions: [],
        livePoints: 0,
        finalize: false,
      });
    }
    setHasEnteredRoom(true);
  };

  // Live Quiz Polling + Sync
  useEffect(() => {
    if (!hasEnteredRoom || joinData?.session?.mode !== 'live_quiz' || !activePin) return;
    let active = true;

    const refreshLive = async () => {
      const st = await getLiveQuizPublicState(activePin);
      if (!active || !st.found) return;
      setLiveState((prev) => {
        if (prev && prev.current_question_index !== st.current_question_index) {
          questionShownAtRef.current = Date.now();
          setLastQuestionResult(null);
        }
        return st;
      });
    };

    void refreshLive();
    const timer = window.setInterval(() => void refreshLive(), 1500);

    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel(HYBRID_EXAM_CHANNEL_NAME);
        channel.onmessage = (ev) => {
          if (ev.data?.pin === activePin) void refreshLive();
        };
      }
    } catch {
      // Ignore unsupported BroadcastChannel
    }

    return () => {
      active = false;
      window.clearInterval(timer);
      channel?.close();
    };
  }, [activePin, hasEnteredRoom, joinData?.session?.mode]);

  // Score Live Quiz speed points safely when the teacher clicks Reveal ('revealed')
  useEffect(() => {
    if (
      !liveState ||
      liveState.status !== 'revealed' ||
      !liveState.revealed_correct ||
      !joinData?.session ||
      !effectiveStudentName
    ) {
      return;
    }

    const qNumKey = liveState.revealed_correct.number;
    if (awardedKeysRef.current.has(qNumKey)) return;
    awardedKeysRef.current.add(qNumKey);

    const studentAns = answers[qNumKey];
    const correctChoice = (liveState.revealed_correct.correctChoice || '').trim().toUpperCase();
    const isCorrect =
      Boolean(correctChoice) &&
      typeof studentAns === 'string' &&
      studentAns.trim().toUpperCase() === correctChoice;

    setLastQuestionResult(isCorrect ? 'correct' : 'wrong');

    if (isCorrect) {
      const answeredAt = answerSubmittedAtRef.current[qNumKey] || Date.now();
      const elapsed = Math.max(0, answeredAt - questionShownAtRef.current);
      const earned = Math.max(550, Math.round(1000 - Math.min(1, elapsed / 25000) * 450));
      const nextPoints = livePoints + earned;
      setLivePoints(nextPoints);

      void submitOnlineExamAttempt({
        pin: activePin,
        studentName: effectiveStudentName,
        studentCode: effectiveStudentCode || null,
        studentId: selectedRosterStudent?.id || null,
        nickname,
        answers,
        flaggedQuestions: flagged,
        livePoints: nextPoints,
        finalize: false,
      });
    }
  }, [
    activePin,
    answers,
    effectiveStudentCode,
    effectiveStudentName,
    flagged,
    joinData?.session,
    livePoints,
    liveState,
    nickname,
    selectedRosterStudent?.id,
  ]);

  const handleSubmitMobileExam = async () => {
    if (!joinData?.session || !effectiveStudentName) return;
    setIsSubmitting(true);
    try {
      const res = await submitOnlineExamAttempt({
        pin: activePin,
        studentName: effectiveStudentName,
        studentCode: effectiveStudentCode || null,
        studentId: selectedRosterStudent?.id || null,
        answers,
        flaggedQuestions: flagged,
        finalize: true,
      });
      setSubmittedResult({
        score: res.score,
        maxScore: res.maxScore,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==================== 1. JOIN BY PIN SCREEN ====================
  if (!joinData?.session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f8f5] p-4">
        <div className="w-full max-w-md rounded-3xl border border-[#dce3d7] bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-extrabold uppercase tracking-wider text-[#2f7d5b]">ClassCare 360</p>
          <h1 className="mt-1 font-display text-2xl font-black text-[#1f2924]">
            เข้าห้องสอบ / ควิซสด
          </h1>
          <p className="mt-1 text-xs font-medium text-[#75827a]">
            กรอกรหัส PIN 6 หลักที่แสดงบนหน้าจอคุณครูเพื่อเข้าทำแบบทดสอบ
          </p>

          <form
            className="mt-5 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void handleJoinPin(pinInput);
            }}
          >
            <input
              type="text"
              inputMode="numeric"
              maxLength={8}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="กรอกรหัส PIN เช่น 482910"
              className="h-14 w-full rounded-2xl border-2 border-[#dce3d7] bg-[#fafbf8] px-4 text-center font-mono text-2xl font-black tracking-[0.25em] text-[#1c342b] outline-none focus:border-[#2f7d5b] focus:bg-white"
            />
            {joinError ? (
              <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{joinError}</p>
            ) : null}
            <button
              type="submit"
              disabled={isJoining}
              className="h-12 w-full rounded-2xl bg-[#1c342b] text-sm font-black text-white shadow-sm transition hover:bg-[#2f7d5b] disabled:opacity-50"
            >
              {isJoining ? 'กำลังค้นหาห้อง...' : 'เข้าห้องสอบเลย'}
            </button>
          </form>
        </div>
      </main>
    );
  }

  const sess = joinData.session;
  const payload = sess.exam_payload;
  const questions = payload.questions || [];

  // ==================== 2. STUDENT IDENTITY SCREEN ====================
  if (!hasEnteredRoom) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f8f5] p-4">
        <div className="w-full max-w-lg rounded-3xl border border-[#dce3d7] bg-white p-6 shadow-sm space-y-4">
          <div className="border-b border-[#f0f2ee] pb-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#e6f4ec] px-2.5 py-0.5 text-[11px] font-bold text-[#1c573d]">
              {sess.mode === 'live_quiz' ? 'โหมดควิซสด' : 'แบบทดสอบออนไลน์'} · PIN {sess.pin_code}
            </span>
            <h1 className="mt-1.5 font-display text-xl font-black text-[#1f2924]">{sess.title}</h1>
            <p className="text-xs font-medium text-[#75827a]">
              {sess.subject_name}
              {sess.classroom_name ? ` · ${sess.classroom_name}` : ''} · {questions.length} ข้อ
            </p>
          </div>

          {payload.instructions ? (
            <div className="rounded-2xl bg-[#fafbf8] p-3 text-xs font-medium text-[#55615a]">
              <strong>คำชี้แจง:</strong> {payload.instructions}
            </div>
          ) : null}

          {joinData.students.length > 0 ? (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#1f2924]">เลือกชื่อของคุณจากรายชื่อห้อง</label>
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="ค้นหาชื่อหรือรหัสนักเรียน..."
                className="h-10 w-full rounded-xl border border-[#dce3d7] bg-[#fafbf8] px-3 text-xs font-medium outline-none focus:border-[#2f7d5b]"
              />
              <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                {filteredRoster.map((st) => {
                  const selected = selectedStudentId === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => {
                        setSelectedStudentId(st.id);
                        setManualName('');
                      }}
                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs font-bold transition ${
                        selected
                          ? 'border-[#2f7d5b] bg-[#e6f4ec] text-[#1c573d]'
                          : 'border-[#e5e8e1] bg-white text-[#1f2924] hover:bg-[#fafbf9]'
                      }`}
                    >
                      <span>
                        {st.student_code ? `#${st.student_code} ` : ''}
                        {st.first_name} {st.last_name}
                      </span>
                      {selected ? <UserCheck size={15} className="text-[#2f7d5b]" /> : null}
                    </button>
                  );
                })}
              </div>
              <p className="pt-1 text-center text-[11px] font-semibold text-[#75827a]">
                หรือพิมพ์ชื่อด้านล่างกรณีไม่มีในรายชื่อ
              </p>
            </div>
          ) : null}

          <div className="grid gap-2.5 sm:grid-cols-2">
            <input
              type="text"
              value={manualName}
              onChange={(e) => {
                setManualName(e.target.value);
                setSelectedStudentId('');
              }}
              placeholder="ชื่อ-นามสกุลนักเรียน"
              className="h-11 rounded-xl border border-[#dce3d7] bg-[#fafbf8] px-3 text-sm font-bold text-[#1f2924] outline-none focus:border-[#2f7d5b]"
            />
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="เลขที่ / รหัส (ถ้ามี)"
              className="h-11 rounded-xl border border-[#dce3d7] bg-[#fafbf8] px-3 text-sm font-bold text-[#1f2924] outline-none focus:border-[#2f7d5b]"
            />
          </div>

          {sess.mode === 'live_quiz' && (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-indigo-950">ชื่อเล่นบนกระดานอันดับ</label>
                <button
                  type="button"
                  onClick={() => setNickname(generateCuteThaiNickname())}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 hover:underline"
                >
                  <Sparkles size={12} /> สุ่มชื่อใหม่
                </button>
              </div>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-xl border border-indigo-200 bg-white px-3 text-sm font-black text-indigo-950 outline-none"
              />
            </div>
          )}

          <button
            type="button"
            disabled={!effectiveStudentName}
            onClick={() => void handleEnterExamRoom()}
            className="h-12 w-full rounded-2xl bg-[#1c342b] text-sm font-black text-white shadow-sm transition hover:bg-[#2f7d5b] disabled:opacity-40"
          >
            {sess.mode === 'live_quiz' ? 'เข้าร่วมควิซสดเลย!' : 'เริ่มทำแบบทดสอบ'}
          </button>
        </div>
      </main>
    );
  }

  // ==================== 3. LIVE QUIZ STUDENT SCREEN ====================
  if (sess.mode === 'live_quiz') {
    const qIdx = liveState?.current_question_index ?? sess.current_question_index ?? 0;
    const liveQuestion = questions[qIdx];
    const qNumKey = liveQuestion ? String(liveQuestion.number) : '';
    const mySelectedAns = qNumKey ? answers[qNumKey] : undefined;

    return (
      <main className="flex min-h-screen flex-col justify-between bg-gradient-to-br from-[#1b1448] via-[#261a66] to-[#34207c] p-4 text-white">
        <header className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-2.5 text-xs font-bold">
          <span>{nickname || effectiveStudentName}</span>
          <span className="rounded-full bg-amber-400/20 px-3 py-1 font-mono font-black text-amber-200">
            {livePoints} แต้ม
          </span>
        </header>

        <div className="mx-auto my-auto w-full max-w-md space-y-5 py-6">
          {(!liveState || liveState.status === 'lobby') && (
            <div className="rounded-3xl bg-white/10 p-8 text-center">
              <Sparkles size={40} className="mx-auto text-amber-300" />
              <h2 className="mt-3 font-display text-2xl font-black">เข้ามาในห้องแล้ว!</h2>
              <p className="mt-2 text-sm text-indigo-200">
                ชื่อของคุณคือ <strong>{nickname}</strong>
              </p>
              <p className="mt-1 text-xs text-indigo-300">มองที่หน้าจอคุณครูเพื่อรอเริ่มข้อที่ 1...</p>
            </div>
          )}

          {liveState?.status === 'active' && liveQuestion && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-white p-4 text-center text-slate-900">
                <p className="text-xs font-bold text-indigo-600">
                  ข้อ {qIdx + 1} / {questions.length}
                </p>
                <h2 className="mt-1 text-lg font-extrabold">{liveQuestion.prompt || `ข้อที่ ${liveQuestion.number}`}</h2>
              </div>

              {(liveQuestion.choices || []).length > 0 ? (
                <div className="grid gap-3">
                  {(liveQuestion.choices || []).map((choiceText, cIdx) => {
                    const code = normalizeChoiceKey(cIdx);
                    const picked = mySelectedAns === code;
                    return (
                      <button
                        key={`${liveQuestion.id}-btn-${cIdx}`}
                        type="button"
                        disabled={Boolean(mySelectedAns)}
                        onClick={() => {
                          answerSubmittedAtRef.current[qNumKey] = Date.now();
                          const nextAns = { ...answers, [qNumKey]: code };
                          setAnswers(nextAns);
                          void submitOnlineExamAttempt({
                            pin: activePin,
                            studentName: effectiveStudentName,
                            studentCode: effectiveStudentCode || null,
                            studentId: selectedRosterStudent?.id || null,
                            nickname,
                            answers: nextAns,
                            flaggedQuestions: flagged,
                            livePoints,
                            finalize: false,
                          });
                        }}
                        className={`flex min-h-[64px] items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left font-black shadow-lg transition ${
                          QUIZ_BTN_STYLES[cIdx % QUIZ_BTN_STYLES.length]
                        } ${mySelectedAns && !picked ? 'opacity-40' : ''} ${picked ? 'ring-4 ring-white' : ''}`}
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-black/25 text-sm">
                          {getChoiceDisplayLabel(payload.choiceLabelType, cIdx)}
                        </span>
                        <span className="flex-1 text-sm">{choiceText}</span>
                        {picked ? <Check size={20} /> : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {mySelectedAns ? (
                <p className="rounded-xl bg-white/15 py-2 text-center text-xs font-bold text-emerald-200">
                  ส่งคำตอบแล้ว! รอคุณครูเฉลย...
                </p>
              ) : null}
            </div>
          )}

          {liveState?.status === 'revealed' && (
            <div className="rounded-3xl bg-white p-6 text-center text-slate-900 shadow-xl space-y-3">
              {lastQuestionResult === 'correct' ? (
                <>
                  <CheckCircle2 size={44} className="mx-auto text-emerald-600" />
                  <h2 className="text-xl font-black text-emerald-800">ตอบถูกต้อง! เก่งมาก!</h2>
                </>
              ) : (
                <>
                  <Award size={44} className="mx-auto text-amber-500" />
                  <h2 className="text-xl font-black text-slate-900">
                    เฉลยคือ {liveState.revealed_correct?.correctChoice || '-'}
                  </h2>
                </>
              )}
              <p className="text-xs font-bold text-slate-500">คะแนนสะสมตอนนี้: {livePoints} แต้ม</p>

              {liveState.leaderboard.length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-3 text-left space-y-1.5">
                  <p className="text-xs font-black text-slate-700">อันดับ Top 5</p>
                  {liveState.leaderboard.slice(0, 5).map((item, idx) => (
                    <div key={item.submission_id} className="flex items-center justify-between text-xs font-bold">
                      <span>
                        {idx + 1}. {item.display_name}
                      </span>
                      <span className="font-mono">{item.live_points}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {liveState?.status === 'closed' && (
            <div className="rounded-3xl bg-white p-6 text-center text-slate-900 shadow-xl space-y-3">
              <Trophy size={48} className="mx-auto text-amber-500" />
              <h2 className="font-display text-2xl font-black">จบควิซแล้ว!</h2>
              <p className="text-sm font-bold text-indigo-700">คะแนนรวมของคุณ: {livePoints} แต้ม</p>
              <div className="space-y-1.5 border-t border-slate-100 pt-3 text-left text-xs font-bold">
                {liveState.leaderboard.slice(0, 5).map((item, idx) => (
                  <div key={item.submission_id} className="flex justify-between">
                    <span>
                      อันดับ {idx + 1}: {item.display_name}
                    </span>
                    <span className="font-mono">{item.live_points}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <footer className="text-center text-[11px] text-indigo-200/70">ClassCare 360 Live Quiz</footer>
      </main>
    );
  }

  // ==================== 4. MOBILE EXAM RESULT SCREEN ====================
  if (submittedResult) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f8f5] p-4">
        <div className="w-full max-w-md rounded-3xl border border-[#dce3d7] bg-white p-7 text-center shadow-sm space-y-4">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#e6f4ec] text-[#1c573d]">
            <CheckCircle2 size={34} />
          </span>
          <h1 className="font-display text-2xl font-black text-[#1f2924]">ส่งคำตอบเรียบร้อยแล้ว!</h1>
          <p className="text-xs font-semibold text-[#75827a]">
            {effectiveStudentName} · {sess.title}
          </p>
          {submittedResult.score !== null && (
            <div className="rounded-2xl bg-[#eaf5ef] p-5">
              <p className="text-xs font-bold text-[#2f7d5b]">คะแนนของคุณ</p>
              <p className="mt-1 font-display text-4xl font-black text-[#1c342b]">
                {submittedResult.score} / {submittedResult.maxScore}
              </p>
            </div>
          )}
          <p className="text-xs font-medium text-[#5b6a5f]">{payload.postSubmitMessage}</p>
        </div>
      </main>
    );
  }

  // ==================== 5. MOBILE EXAM QUESTION-BY-QUESTION UI ====================
  const activeQ = questions[currentIdx];
  const activeKey = activeQ ? String(activeQ.number) : '';
  const activeAns = activeKey ? answers[activeKey] : undefined;
  const isFlagged = activeQ ? flagged.includes(activeQ.number) : false;
  const answeredCount = questions.filter((q) => {
    const val = answers[String(q.number)];
    return Array.isArray(val) ? val.length > 0 : Boolean(val && String(val).trim());
  }).length;

  return (
    <main className="flex min-h-screen flex-col bg-[#f6f8f5] pb-24">
      {/* Top Bar */}
      <header className="sticky top-0 z-20 border-b border-[#e5e8e1] bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-extrabold text-[#1f2924]">{sess.title}</p>
            <p className="text-[11px] font-semibold text-[#75827a]">
              ข้อ {currentIdx + 1} จาก {questions.length} · ตอบแล้ว {answeredCount} ข้อ
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsNavigatorOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#dce3d7] bg-[#fafbf8] px-3 text-xs font-bold text-[#1f2924]"
          >
            <LayoutGrid size={14} />
            <span>ดูทุกข้อ</span>
          </button>
        </div>
      </header>

      {/* Active Question Card */}
      {activeQ ? (
        <div className="mx-auto w-full max-w-2xl flex-1 p-4 space-y-4">
          <div className="rounded-3xl border border-[#e5e8e1] bg-white p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full bg-[#e6f4ec] px-3 py-1 text-xs font-extrabold text-[#1c573d]">
                ข้อ {activeQ.number} ({activeQ.points} คะแนน)
              </span>
              <button
                type="button"
                onClick={() =>
                  setFlagged((prev) =>
                    prev.includes(activeQ.number)
                      ? prev.filter((n) => n !== activeQ.number)
                      : [...prev, activeQ.number],
                  )
                }
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold transition ${
                  isFlagged
                    ? 'border-amber-300 bg-amber-50 text-amber-800'
                    : 'border-[#dce3d7] bg-white text-[#5b6a5f]'
                }`}
              >
                <Flag size={12} className={isFlagged ? 'fill-amber-500 text-amber-600' : ''} />
                <span>{isFlagged ? 'ปักธงทวนอยู่' : 'ปักธงกลับมาทวน'}</span>
              </button>
            </div>

            <h2 className="text-base font-extrabold leading-relaxed text-[#1f2924] sm:text-lg">
              {activeQ.prompt || `คำถามข้อที่ ${activeQ.number}`}
            </h2>

            {(activeQ.type === 'single_choice' || activeQ.type === 'multiple_choice') && (
              <div className="space-y-2.5 pt-1">
                {(activeQ.choices || []).map((choiceText, cIdx) => {
                  const code = normalizeChoiceKey(cIdx);
                  const isSelected =
                    activeQ.type === 'single_choice'
                      ? activeAns === code
                      : Array.isArray(activeAns) && activeAns.includes(code);

                  return (
                    <button
                      key={`${activeQ.id}-ans-${cIdx}`}
                      type="button"
                      onClick={() => {
                        if (activeQ.type === 'single_choice') {
                          setAnswers((prev) => ({ ...prev, [activeKey]: code }));
                        } else {
                          const cur = Array.isArray(activeAns) ? activeAns : [];
                          const next = cur.includes(code)
                            ? cur.filter((x) => x !== code)
                            : [...cur, code];
                          setAnswers((prev) => ({ ...prev, [activeKey]: next }));
                        }
                      }}
                      className={`flex min-h-[54px] w-full items-center gap-3 rounded-2xl border-2 px-3.5 py-2.5 text-left transition ${
                        isSelected
                          ? 'border-[#2f7d5b] bg-[#e6f4ec] text-[#1c573d]'
                          : 'border-[#e5e8e1] bg-[#fafbf9] text-[#1f2924] hover:border-[#bfe0cd]'
                      }`}
                    >
                      <span
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs font-black ${
                          isSelected ? 'bg-[#2f7d5b] text-white' : 'bg-white border border-[#dce3d7] text-[#55615a]'
                        }`}
                      >
                        {getChoiceDisplayLabel(payload.choiceLabelType, cIdx)}
                      </span>
                      <span className="flex-1 text-sm font-bold">{choiceText}</span>
                      {isSelected ? <Check size={17} className="shrink-0 text-[#2f7d5b]" /> : null}
                    </button>
                  );
                })}
              </div>
            )}

            {(activeQ.type === 'short_answer' || activeQ.type === 'essay') && (
              <textarea
                rows={activeQ.type === 'essay' ? 5 : 2}
                value={typeof activeAns === 'string' ? activeAns : ''}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [activeKey]: e.target.value }))}
                placeholder="พิมพ์คำตอบของคุณที่นี่..."
                className="w-full rounded-2xl border border-[#dce3d7] bg-[#fafbf9] p-3.5 text-sm font-semibold text-[#1f2924] outline-none focus:border-[#2f7d5b] focus:bg-white"
              />
            )}
          </div>
        </div>
      ) : null}

      {/* Bottom Navigation Bar */}
      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-[#e5e8e1] bg-white px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2.5">
          <button
            type="button"
            disabled={currentIdx === 0}
            onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
            className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-[#dce3d7] bg-[#fafbf9] px-4 text-xs font-bold text-[#1f2924] disabled:opacity-40"
          >
            <ArrowLeft size={15} />
            <span>ข้อก่อนหน้า</span>
          </button>

          {currentIdx + 1 < questions.length ? (
            <button
              type="button"
              onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
              className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#1c342b] px-5 text-xs font-black text-white"
            >
              <span>ข้อถัดไป</span>
              <ArrowRight size={15} />
            </button>
          ) : (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleSubmitMobileExam()}
              className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#2f7d5b] px-5 text-xs font-black text-white shadow-sm disabled:opacity-50"
            >
              <Send size={15} />
              <span>{isSubmitting ? 'กำลังส่ง...' : `ส่งข้อสอบ (${answeredCount}/${questions.length})`}</span>
            </button>
          )}
        </div>
      </footer>

      {/* All-Questions Navigator Sheet */}
      {isNavigatorOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 sm:items-center sm:p-4"
          onClick={() => setIsNavigatorOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-white p-5 sm:rounded-3xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-[#1f2924]">ภาพรวมข้อสอบ ({questions.length} ข้อ)</h3>
              <button type="button" onClick={() => setIsNavigatorOpen(false)} className="rounded-lg p-1 text-slate-500">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, idx) => {
                const val = answers[String(q.number)];
                const isAnswered = Array.isArray(val) ? val.length > 0 : Boolean(val && String(val).trim());
                const qFlagged = flagged.includes(q.number);
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => {
                      setCurrentIdx(idx);
                      setIsNavigatorOpen(false);
                    }}
                    className={`relative h-10 rounded-xl border text-xs font-black transition ${
                      idx === currentIdx
                        ? 'border-[#1c342b] bg-[#1c342b] text-white'
                        : qFlagged
                          ? 'border-amber-300 bg-amber-50 text-amber-900'
                          : isAnswered
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                            : 'border-[#e5e8e1] bg-[#fafbf9] text-slate-600'
                    }`}
                  >
                    {q.number}
                    {qFlagged ? (
                      <Flag size={9} className="absolute right-1 top-1 fill-amber-500 text-amber-600" />
                    ) : null}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between border-t border-[#f0f2ee] pt-3 text-[11px] font-bold text-[#75827a]">
              <span>ตอบแล้ว {answeredCount} · ปักธง {flagged.length}</span>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void handleSubmitMobileExam()}
                className="rounded-xl bg-[#2f7d5b] px-4 py-2 text-xs font-black text-white"
              >
                ส่งข้อสอบเลย
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
