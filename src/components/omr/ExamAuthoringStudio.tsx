import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Eye,
  FileText,
  KeyRound,
  MonitorPlay,
  Plus,
  Printer,
  Smartphone,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { getEffectiveAiConfig } from '../../lib/aiSettings';
import { callGeminiPrompt } from '../../lib/geminiClient';
import {
  buildDefaultQuestionsFromOmrConfig,
  getChoiceDisplayLabel,
  normalizeChoiceKey,
  syncQuestionsToOmrConfig,
} from '../../lib/hybridExamService';
import type { AppSessionContext } from '../../types/core';
import type {
  AnswerSheetConfig,
  ChoiceLabelType,
  ExamQuestionItem,
  ExamQuestionType,
  ShortAnswerStrictness,
} from '../../types/omr';

interface ExamAuthoringStudioProps {
  config: AnswerSheetConfig;
  onChangeConfig: (next: AnswerSheetConfig) => void;
  onPrintOmr: () => void;
  onLaunchMobileExam: () => void;
  onLaunchLiveQuiz: () => void;
  session: AppSessionContext | null;
}

type StudioEditorMode = 'write' | 'key';

const SECTION_DEFS: Array<{
  sectionIndex: 1 | 2 | 3 | 4;
  type: ExamQuestionType;
  label: string;
  shortLabel: string;
}> = [
  { sectionIndex: 1, type: 'single_choice', label: 'ตอนที่ 1 ปรนัยเลือกคำตอบเดียว', shortLabel: 'ปรนัย 1 คำตอบ' },
  { sectionIndex: 2, type: 'multiple_choice', label: 'ตอนที่ 2 ปรนัยเลือกหลายคำตอบ', shortLabel: 'เลือกหลายข้อ' },
  { sectionIndex: 3, type: 'short_answer', label: 'ตอนที่ 3 ตอบสั้น (ตรวจอัตโนมัติ)', shortLabel: 'ตอบสั้น' },
  { sectionIndex: 4, type: 'essay', label: 'ตอนที่ 4 อัตนัย / ข้อเขียน', shortLabel: 'อัตนัย' },
];

function renumberQuestions(items: ExamQuestionItem[]): ExamQuestionItem[] {
  return [...items]
    .sort((a, b) => a.sectionIndex - b.sectionIndex)
    .map((item, idx) => ({
      ...item,
      number: idx + 1,
    }));
}

export function ExamAuthoringStudio({
  config,
  onChangeConfig,
  onPrintOmr,
  onLaunchMobileExam,
  onLaunchLiveQuiz,
  session,
}: ExamAuthoringStudioProps) {
  const [editorMode, setEditorMode] = useState<StudioEditorMode>('write');
  const [activeQuestionId, setActiveQuestionId] = useState<string>('');
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiCount, setAiCount] = useState(5);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [shortAnswerDraft, setShortAnswerDraft] = useState<Record<string, string>>({});

  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const questions = useMemo<ExamQuestionItem[]>(
    () => buildDefaultQuestionsFromOmrConfig(config),
    [config],
  );

  // Persist synchronized questions whenever initialized or modified
  const commitQuestions = (nextItems: ExamQuestionItem[], configPatch?: Partial<AnswerSheetConfig>) => {
    const normalized = renumberQuestions(nextItems);
    const synced = syncQuestionsToOmrConfig({ ...config, ...configPatch }, normalized);
    onChangeConfig(synced);
  };

  // Keyboard shortcuts: K toggles write/answer key mode (outside text inputs); Esc blurs active field
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditingText =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if (event.key === 'Escape' && isEditingText) {
        target.blur();
        return;
      }

      if ((event.key === 'k' || event.key === 'K') && (!isEditingText || event.altKey)) {
        event.preventDefault();
        setEditorMode((prev) => (prev === 'write' ? 'key' : 'write'));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const scrollToQuestion = (qId: string) => {
    setActiveQuestionId(qId);
    const el = questionRefs.current[qId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleAddQuestion = (sectionIndex: 1 | 2 | 3 | 4) => {
    const def = SECTION_DEFS.find((s) => s.sectionIndex === sectionIndex) || SECTION_DEFS[0];
    const choicesLen = config.choicesCount || 4;
    const newId = `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const nextNum = questions.length + 1;
    const newItem: ExamQuestionItem = {
      id: newId,
      number: nextNum,
      sectionIndex,
      type: def.type,
      prompt: '',
      ...(def.type === 'single_choice' || def.type === 'multiple_choice'
        ? {
            choices: Array.from(
              { length: choicesLen },
              (_, idx) => `ตัวเลือก ${getChoiceDisplayLabel(config.choiceLabelType, idx)}`,
            ),
            correctChoice: def.type === 'single_choice' ? 'A' : undefined,
            correctChoices: def.type === 'multiple_choice' ? ['A'] : undefined,
          }
        : {}),
      ...(def.type === 'short_answer' ? { acceptedTextAnswers: [] } : {}),
      points: 1,
    };

    commitQuestions([...questions, newItem]);
    window.setTimeout(() => scrollToQuestion(newId), 60);
  };

  const handleDuplicateQuestion = (item: ExamQuestionItem) => {
    const newId = `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const copy: ExamQuestionItem = {
      ...item,
      id: newId,
      choices: item.choices ? [...item.choices] : undefined,
      correctChoices: item.correctChoices ? [...item.correctChoices] : undefined,
      acceptedTextAnswers: item.acceptedTextAnswers ? [...item.acceptedTextAnswers] : undefined,
    };
    const idx = questions.findIndex((q) => q.id === item.id);
    const next = [...questions];
    next.splice(idx + 1, 0, copy);
    commitQuestions(next);
    window.setTimeout(() => scrollToQuestion(newId), 60);
  };

  const handleDeleteQuestion = (id: string) => {
    if (questions.length <= 1) return;
    commitQuestions(questions.filter((q) => q.id !== id));
  };

  const handleUpdateQuestion = (id: string, patch: Partial<ExamQuestionItem>) => {
    commitQuestions(questions.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  };

  const handleGenerateWithAi = async () => {
    const topicText = aiTopic.trim() || config.subjectName || 'ความรู้ทั่วไป';
    const count = Math.max(1, Math.min(15, aiCount));
    setIsGeneratingAi(true);
    setAiMessage(null);

    try {
      const aiCfg = await getEffectiveAiConfig(session);
      if (aiCfg.apiKey) {
        const raw = await callGeminiPrompt({
          apiKey: aiCfg.apiKey,
          model: aiCfg.model,
          responseJson: true,
          prompt: `สร้างข้อสอบปรนัย 4 ตัวเลือก จำนวน ${count} ข้อ สำหรับวิชา "${config.subjectName}" หัวข้อ "${topicText}" ระดับประถม-มัธยม
ตอบเป็น JSON array เท่านั้น รูปแบบ:
[{"prompt":"คำถาม","choices":["ก","ข","ค","ง"],"correctIndex":0,"points":1}]
โดย choices ไม่ต้องใส่ ก. ข. นำหน้า และ correctIndex เป็นเลข 0-3`,
        });

        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw) as Array<{
          prompt?: string;
          choices?: string[];
          correctIndex?: number;
          points?: number;
        }>;

        if (Array.isArray(parsed) && parsed.length > 0) {
          const generated: ExamQuestionItem[] = parsed.map((row, idx) => ({
            id: `ai-${Date.now()}-${idx}`,
            number: idx + 1,
            sectionIndex: 1,
            type: 'single_choice',
            prompt: row.prompt?.trim() || `คำถามข้อ ${idx + 1} เรื่อง ${topicText}`,
            choices: Array.isArray(row.choices) && row.choices.length >= 3 ? row.choices.slice(0, 5) : ['ตัวเลือก A', 'ตัวเลือก B', 'ตัวเลือก C', 'ตัวเลือก D'],
            correctChoice: normalizeChoiceKey(Math.max(0, Math.min(3, Number(row.correctIndex ?? 0)))),
            points: Number(row.points) > 0 ? Number(row.points) : 1,
          }));
          commitQuestions(generated, {
            title: config.title || `แบบทดสอบเรื่อง ${topicText}`,
          });
          setAiMessage(`สร้างข้อสอบเรื่อง "${topicText}" จำนวน ${generated.length} ข้อสำเร็จ!`);
          setIsAiDrawerOpen(false);
          return;
        }
      }

      // Clean fallback template when Gemini API Key is not configured
      const fallbackItems: ExamQuestionItem[] = Array.from({ length: count }, (_, idx) => ({
        id: `tpl-${Date.now()}-${idx}`,
        number: idx + 1,
        sectionIndex: 1,
        type: 'single_choice',
        prompt: `ข้อที่ ${idx + 1}: จงเลือกคำตอบที่ถูกต้องเกี่ยวกับ "${topicText}"`,
        choices: ['คำตอบที่ 1', 'คำตอบที่ 2', 'คำตอบที่ 3', 'คำตอบที่ 4'],
        correctChoice: normalizeChoiceKey(idx % 4),
        points: 1,
      }));
      commitQuestions(fallbackItems);
      setAiMessage(
        aiCfg.apiKey
          ? 'สร้างเทมเพลตข้อสอบให้เรียบร้อย (แก้ไขโจทย์ต่อได้ทันที)'
          : 'สร้างเทมเพลตข้อสอบเบื้องต้นให้เรียบร้อย (ตั้งค่า Gemini API Key เพื่อช่วยคิดโจทย์อัตโนมัติ)',
      );
      setIsAiDrawerOpen(false);
    } catch (err) {
      setAiMessage(err instanceof Error ? err.message : 'ไม่สามารถสร้างโจทย์อัตโนมัติได้');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const totalPoints = useMemo(
    () => questions.reduce((sum, q) => sum + (Number.isFinite(q.points) ? q.points : 1), 0),
    [questions],
  );
  const unkeyedCount = useMemo(
    () =>
      questions.filter((q) => {
        if (q.type === 'single_choice') return !q.correctChoice;
        if (q.type === 'multiple_choice') return !q.correctChoices || q.correctChoices.length === 0;
        if (q.type === 'short_answer') return !q.acceptedTextAnswers || q.acceptedTextAnswers.length === 0;
        return false;
      }).length,
    [questions],
  );

  const strictness: ShortAnswerStrictness = config.shortAnswerStrictness || 'normal';

  const strictnessExample =
    strictness === 'lenient'
      ? 'เฉลย "H2O": "H 2 O" ผ่าน · "h2o" ผ่าน · "H๒O" ผ่าน'
      : strictness === 'strict'
        ? 'เฉลย "H2O": ต้องพิมพ์ตรง "H2O" เป๊ะ ("h2o" และ "H 2 O" ไม่ผ่าน)'
        : 'เฉลย "H2O": "h2o" ผ่าน · "H 2 O" ไม่ผ่าน';

  return (
    <div className="space-y-4">
      {/* Top Studio Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[#e5e8e1] bg-white p-4 shadow-2xs lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-[#f1f3ef] p-1">
            <button
              type="button"
              onClick={() => setEditorMode('write')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                editorMode === 'write'
                  ? 'bg-white text-[#1f2924] shadow-2xs'
                  : 'text-[#5b6a5f] hover:text-[#1f2924]'
              }`}
            >
              <FileText size={14} aria-hidden="true" />
              <span>เขียนโจทย์</span>
            </button>
            <button
              type="button"
              onClick={() => setEditorMode('key')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                editorMode === 'key'
                  ? 'bg-[#1c342b] text-white shadow-2xs'
                  : 'text-[#5b6a5f] hover:text-[#1f2924]'
              }`}
            >
              <KeyRound size={14} aria-hidden="true" />
              <span>เฉลยและคะแนน</span>
            </button>
          </div>

          <span className="text-xs font-semibold text-[#75827a]">
            {questions.length} ข้อ · {totalPoints} คะแนน
            {unkeyedCount > 0 ? ` · ยังไม่ตั้งเฉลย ${unkeyedCount} ข้อ` : ' · พร้อมใช้งานครบทุกข้อ'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAiDrawerOpen((v) => !v)}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 text-xs font-bold text-violet-900 transition hover:bg-violet-100"
          >
            <Sparkles size={14} className="text-violet-600" aria-hidden="true" />
            <span>สร้างโจทย์ด้วย AI</span>
          </button>

          <button
            type="button"
            onClick={onPrintOmr}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#dce3d7] bg-[#fafbf9] px-3 text-xs font-bold text-[#1f2924] transition hover:bg-[#f0f3ee]"
          >
            <Printer size={14} aria-hidden="true" />
            <span>พิมพ์กระดาษ OMR</span>
          </button>

          <button
            type="button"
            onClick={onLaunchMobileExam}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 text-xs font-bold text-sky-900 transition hover:bg-sky-100"
          >
            <Smartphone size={14} aria-hidden="true" />
            <span>สอบบนมือถือ</span>
          </button>

          <button
            type="button"
            onClick={onLaunchLiveQuiz}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#2f7d5b] px-3.5 text-xs font-bold text-white shadow-2xs transition hover:bg-[#1c573d]"
          >
            <MonitorPlay size={14} aria-hidden="true" />
            <span>เริ่มควิซสด</span>
          </button>
        </div>
      </div>

      {/* AI Helper Drawer */}
      {isAiDrawerOpen ? (
        <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="block text-xs font-bold text-violet-950">หัวข้อหรือบทเรียนที่ต้องการออกข้อสอบ</label>
              <input
                type="text"
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                placeholder={`เช่น เศษส่วน ป.5, แรงและการเคลื่อนที่, คำราชาศัพท์`}
                className="mt-1 h-10 w-full rounded-xl border border-violet-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:border-violet-500"
              />
            </div>
            <div className="w-28">
              <label className="block text-xs font-bold text-violet-950">จำนวนข้อ</label>
              <select
                value={aiCount}
                onChange={(e) => setAiCount(Number(e.target.value))}
                className="mt-1 h-10 w-full rounded-xl border border-violet-200 bg-white px-2.5 text-sm font-bold text-slate-900 outline-none"
              >
                {[3, 5, 10, 15].map((n) => (
                  <option key={n} value={n}>
                    {n} ข้อ
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={isGeneratingAi}
              onClick={() => void handleGenerateWithAi()}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-violet-700 px-4 text-xs font-bold text-white transition hover:bg-violet-800 disabled:opacity-50"
            >
              <Sparkles size={14} aria-hidden="true" />
              <span>{isGeneratingAi ? 'กำลังสร้าง...' : 'สร้างชุดโจทย์'}</span>
            </button>
          </div>
        </div>
      ) : null}

      {aiMessage ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-900">
          <span>{aiMessage}</span>
          <button type="button" onClick={() => setAiMessage(null)} className="underline">
            ปิด
          </button>
        </div>
      ) : null}

      {/* 3-Column Studio Workspace */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* LEFT COLUMN: Section & Question Navigator (3 cols) */}
        <aside className="rounded-2xl border border-[#e5e8e1] bg-white p-4 shadow-2xs lg:col-span-3 lg:sticky lg:top-20 lg:self-start">
          <p className="text-xs font-extrabold text-[#1f2924]">ข้อสอบทั้งฉบับ</p>
          <p className="mt-0.5 text-[11px] font-medium text-[#75827a]">คลิกเลขข้อเพื่อกระโดดไปแก้ไขทันที</p>

          <div className="mt-3 space-y-4">
            {SECTION_DEFS.map((section) => {
              const sectionItems = questions.filter((q) => q.sectionIndex === section.sectionIndex);
              return (
                <div key={section.sectionIndex} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-[11px] font-bold text-[#5b6a5f]">
                      {section.shortLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAddQuestion(section.sectionIndex)}
                      className="inline-flex items-center gap-0.5 rounded-md bg-[#f1f3ef] px-1.5 py-0.5 text-[10px] font-bold text-[#1c573d] hover:bg-[#e6f4ec]"
                    >
                      <Plus size={10} aria-hidden="true" /> เพิ่ม
                    </button>
                  </div>

                  {sectionItems.length > 0 ? (
                    <div className="grid grid-cols-5 gap-1.5">
                      {sectionItems.map((q) => {
                        const isActive = activeQuestionId === q.id;
                        return (
                          <button
                            key={q.id}
                            type="button"
                            onClick={() => scrollToQuestion(q.id)}
                            className={`h-8 rounded-lg border text-xs font-bold transition ${
                              isActive
                                ? 'border-[#1c342b] bg-[#1c342b] text-white'
                                : 'border-[#e5e8e1] bg-[#fafbf9] text-[#1f2924] hover:border-[#2f7d5b] hover:bg-[#e6f4ec]'
                            }`}
                          >
                            {q.number}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[10px] font-medium text-[#9aa59e]">ยังไม่มีข้อสอบในตอนนี้</p>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* CENTER COLUMN: Question Editor Cards (6 cols) */}
        <section className="space-y-3 lg:col-span-6" aria-label="ตัวแก้ไขข้อสอบ">
          {/* Exam Meta Header Card */}
          <div className="rounded-2xl border border-[#e5e8e1] bg-white p-4 shadow-2xs space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-bold text-[#75827a]">ชื่อแบบทดสอบ</label>
                <input
                  type="text"
                  value={config.title}
                  onChange={(e) => onChangeConfig({ ...config, title: e.target.value })}
                  className="mt-1 h-9 w-full rounded-xl border border-[#dce3d7] bg-[#fafbf9] px-3 text-sm font-bold text-[#1f2924] outline-none focus:border-[#2f7d5b] focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#75827a]">รายวิชา</label>
                <input
                  type="text"
                  value={config.subjectName}
                  onChange={(e) => onChangeConfig({ ...config, subjectName: e.target.value })}
                  className="mt-1 h-9 w-full rounded-xl border border-[#dce3d7] bg-[#fafbf9] px-3 text-sm font-bold text-[#1f2924] outline-none focus:border-[#2f7d5b] focus:bg-white"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-bold text-[#75827a]">คำชี้แจงก่อนเริ่มทำข้อสอบ</label>
                <input
                  type="text"
                  value={config.instructions}
                  onChange={(e) => onChangeConfig({ ...config, instructions: e.target.value })}
                  placeholder="เช่น เลือกคำตอบที่ถูกต้องที่สุดเพียงข้อเดียว"
                  className="mt-1 h-9 w-full rounded-xl border border-[#dce3d7] bg-[#fafbf9] px-3 text-xs font-medium text-[#1f2924] outline-none focus:border-[#2f7d5b] focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#75827a]">ข้อความหลังนักเรียนส่งคำตอบ</label>
                <input
                  type="text"
                  value={config.postSubmitMessage || ''}
                  onChange={(e) => onChangeConfig({ ...config, postSubmitMessage: e.target.value })}
                  placeholder="เช่น ส่งคำตอบสำเร็จ ขอบคุณที่ตั้งใจทำข้อสอบ!"
                  className="mt-1 h-9 w-full rounded-xl border border-[#dce3d7] bg-[#fafbf9] px-3 text-xs font-medium text-[#1f2924] outline-none focus:border-[#2f7d5b] focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* Questions List */}
          {questions.map((q) => {
            const sectionMeta = SECTION_DEFS.find((s) => s.sectionIndex === q.sectionIndex) || SECTION_DEFS[0];
            return (
              <div
                key={q.id}
                ref={(el) => {
                  questionRefs.current[q.id] = el;
                }}
                onFocus={() => setActiveQuestionId(q.id)}
                className={`rounded-2xl border bg-white p-4 shadow-2xs transition ${
                  activeQuestionId === q.id ? 'border-[#2f7d5b] ring-2 ring-[#2f7d5b]/10' : 'border-[#e5e8e1]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-[#f1f3ef] px-2.5 py-1 text-xs font-extrabold text-[#1f2924]">
                      ข้อ {q.number}
                    </span>
                    <span className="rounded-full bg-[#eaf5ef] px-2.5 py-0.5 text-[11px] font-bold text-[#1c573d]">
                      {sectionMeta.shortLabel}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <label className="inline-flex items-center gap-1 rounded-lg border border-[#e5e8e1] bg-[#fafbf9] px-2 py-1 text-[11px] font-bold text-[#55615a]">
                      <span>คะแนน</span>
                      <input
                        type="number"
                        min="0.5"
                        step="0.5"
                        value={q.points}
                        onChange={(e) =>
                          handleUpdateQuestion(q.id, { points: Math.max(0.5, Number(e.target.value) || 1) })
                        }
                        className="w-10 bg-transparent text-center font-black text-[#1f2924] outline-none"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => handleDuplicateQuestion(q)}
                      title="ทำสำเนาข้อนี้"
                      className="grid h-7 w-7 place-items-center rounded-lg text-[#75827a] hover:bg-[#f1f3ef] hover:text-[#1f2924]"
                    >
                      <Copy size={13} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      disabled={questions.length <= 1}
                      onClick={() => handleDeleteQuestion(q.id)}
                      title="ลบข้อนี้"
                      className="grid h-7 w-7 place-items-center rounded-lg text-[#75827a] hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* Question Prompt */}
                <input
                  type="text"
                  value={q.prompt}
                  onChange={(e) => handleUpdateQuestion(q.id, { prompt: e.target.value })}
                  placeholder={`พิมพ์คำถามข้อที่ ${q.number}...`}
                  className="mt-3 h-10 w-full rounded-xl border border-[#dce3d7] bg-[#fafbf9] px-3 text-sm font-bold text-[#1f2924] outline-none focus:border-[#2f7d5b] focus:bg-white"
                />

                {/* Choices (Single or Multiple) */}
                {(q.type === 'single_choice' || q.type === 'multiple_choice') && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {(q.choices || []).map((choiceText, cIdx) => {
                      const choiceCode = normalizeChoiceKey(cIdx);
                      const isCorrect =
                        q.type === 'single_choice'
                          ? (q.correctChoice || '').toUpperCase() === choiceCode
                          : (q.correctChoices || []).includes(choiceCode);
                      const choiceLabel = getChoiceDisplayLabel(config.choiceLabelType, cIdx);

                      const toggleCorrect = () => {
                        if (q.type === 'single_choice') {
                          handleUpdateQuestion(q.id, { correctChoice: choiceCode });
                        } else {
                          const current = new Set(q.correctChoices || []);
                          if (current.has(choiceCode)) current.delete(choiceCode);
                          else current.add(choiceCode);
                          handleUpdateQuestion(q.id, { correctChoices: Array.from(current).sort() });
                        }
                      };

                      return (
                        <div
                          key={`${q.id}-c-${cIdx}`}
                          className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 transition ${
                            isCorrect
                              ? 'border-emerald-300 bg-emerald-50/70'
                              : 'border-[#e5e8e1] bg-[#fafbf9]'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={toggleCorrect}
                            title={isCorrect ? 'เฉลยที่ถูกต้อง' : 'คลิกเพื่อตั้งเป็นคำตอบที่ถูก'}
                            className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-black transition ${
                              isCorrect
                                ? 'bg-emerald-600 text-white'
                                : 'border border-[#dce3d7] bg-white text-[#55615a] hover:border-emerald-400'
                            }`}
                          >
                            {isCorrect ? <Check size={13} aria-hidden="true" /> : choiceLabel}
                          </button>
                          <input
                            type="text"
                            value={choiceText}
                            onChange={(e) => {
                              const nextChoices = [...(q.choices || [])];
                              nextChoices[cIdx] = e.target.value;
                              handleUpdateQuestion(q.id, { choices: nextChoices });
                            }}
                            onKeyDown={(e) => {
                              if (
                                e.key === 'Enter' &&
                                cIdx === (q.choices?.length || 0) - 1 &&
                                (q.choices?.length || 0) < 5
                              ) {
                                e.preventDefault();
                                handleUpdateQuestion(q.id, {
                                  choices: [
                                    ...(q.choices || []),
                                    `ตัวเลือก ${getChoiceDisplayLabel(config.choiceLabelType, (q.choices?.length || 0))}`,
                                  ],
                                });
                              }
                            }}
                            placeholder={`ตัวเลือก ${choiceLabel}`}
                            className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-[#1f2924] outline-none"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Short Answer Accepted Responses */}
                {q.type === 'short_answer' && (
                  <div className="mt-3 rounded-xl border border-[#e5e8e1] bg-[#fafbf9] p-3">
                    <p className="text-[11px] font-bold text-[#5b6a5f]">
                      คำตอบที่ตรวจให้ผ่านอัตโนมัติ ({q.acceptedTextAnswers?.length || 0} คำตอบ):
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(q.acceptedTextAnswers || []).map((ans, idx) => (
                        <span
                          key={`${q.id}-ans-${idx}`}
                          className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800"
                        >
                          <CheckCircle2 size={12} aria-hidden="true" />
                          <span>{ans}</span>
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateQuestion(q.id, {
                                acceptedTextAnswers: (q.acceptedTextAnswers || []).filter((_, i) => i !== idx),
                              })
                            }
                            className="ml-0.5 text-emerald-600 hover:text-rose-600"
                            aria-label="ลบคำตอบนี้"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={shortAnswerDraft[q.id] || ''}
                        onChange={(e) => setShortAnswerDraft((d) => ({ ...d, [q.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const val = (shortAnswerDraft[q.id] || '').trim();
                            if (!val) return;
                            handleUpdateQuestion(q.id, {
                              acceptedTextAnswers: [...(q.acceptedTextAnswers || []), val],
                            });
                            setShortAnswerDraft((d) => ({ ...d, [q.id]: '' }));
                          }
                        }}
                        placeholder="พิมพ์คำตอบที่ถูกต้องแล้วกด Enter (เช่น H2O)"
                        className="h-9 flex-1 rounded-xl border border-[#dce3d7] bg-white px-3 text-xs font-medium outline-none focus:border-[#2f7d5b]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const val = (shortAnswerDraft[q.id] || '').trim();
                          if (!val) return;
                          handleUpdateQuestion(q.id, {
                            acceptedTextAnswers: [...(q.acceptedTextAnswers || []), val],
                          });
                          setShortAnswerDraft((d) => ({ ...d, [q.id]: '' }));
                        }}
                        className="rounded-xl bg-[#1c342b] px-3 text-xs font-bold text-white"
                      >
                        เพิ่ม
                      </button>
                    </div>
                  </div>
                )}

                {/* Essay Info */}
                {q.type === 'essay' && (
                  <p className="mt-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-[#75827a]">
                    <Eye size={13} aria-hidden="true" />
                    ข้อสอบอัตนัย — นักเรียนพิมพ์ตอบบนมือถือได้ และครูตรวจให้คะแนนภายหลัง
                  </p>
                )}

                {editorMode === 'key' && q.type !== 'essay' ? (
                  <p className="mt-2 text-[11px] font-bold text-emerald-700">
                    เฉลยปัจจุบัน:{' '}
                    {q.type === 'single_choice'
                      ? q.correctChoice || 'ยังไม่เลือก'
                      : q.type === 'multiple_choice'
                        ? (q.correctChoices || []).join(', ') || 'ยังไม่เลือก'
                        : (q.acceptedTextAnswers || []).join(' | ') || 'ยังไม่กำหนด'}
                  </p>
                ) : null}
              </div>
            );
          })}

          <div className="flex flex-wrap gap-2 pt-1">
            {SECTION_DEFS.map((sec) => (
              <button
                key={sec.sectionIndex}
                type="button"
                onClick={() => handleAddQuestion(sec.sectionIndex)}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-dashed border-[#c7d2ca] bg-white px-3.5 text-xs font-bold text-[#1c573d] hover:border-[#2f7d5b] hover:bg-[#e6f4ec]/50"
              >
                <Plus size={14} aria-hidden="true" />
                <span>เพิ่ม{sec.shortLabel}</span>
              </button>
            ))}
          </div>
        </section>

        {/* RIGHT COLUMN: Exam-Wide Settings Inspector (3 cols) */}
        <aside className="rounded-2xl border border-[#e5e8e1] bg-white p-4 shadow-2xs space-y-4 lg:col-span-3 lg:sticky lg:top-20 lg:self-start">
          <div>
            <p className="text-xs font-extrabold text-[#1f2924]">ข้อสอบทั้งฉบับ</p>
            <p className="mt-0.5 text-[11px] font-semibold text-[#75827a]">
              {questions.length} ข้อ · ยังไม่พร้อม {unkeyedCount} ข้อ
            </p>
          </div>

          <div className="border-t border-[#f0f2ee] pt-3">
            <p className="text-xs font-bold text-[#1f2924]">จำนวนตัวเลือกเริ่มต้น</p>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {([3, 4, 5] as const).map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => onChangeConfig({ ...config, choicesCount: cnt })}
                  className={`h-8 rounded-lg border text-xs font-bold transition ${
                    (config.choicesCount || 4) === cnt
                      ? 'border-[#1c342b] bg-[#1c342b] text-white'
                      : 'border-[#e5e8e1] bg-[#fafbf9] text-[#55615a] hover:bg-[#f0f3ee]'
                  }`}
                >
                  {cnt} ตัวเลือก
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-[#f0f2ee] pt-3">
            <p className="text-xs font-bold text-[#1f2924]">ป้ายตัวเลือกทั้งฉบับ</p>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {(
                [
                  { value: 'THAI', label: 'ก ข ค' },
                  { value: 'ABCD', label: 'A B C' },
                  { value: 'NUMERIC', label: '1 2 3' },
                ] as Array<{ value: ChoiceLabelType; label: string }>
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChangeConfig({ ...config, choiceLabelType: opt.value })}
                  className={`h-8 rounded-lg border text-xs font-bold transition ${
                    (config.choiceLabelType || 'THAI') === opt.value
                      ? 'border-[#1c342b] bg-[#1c342b] text-white'
                      : 'border-[#e5e8e1] bg-[#fafbf9] text-[#55615a] hover:bg-[#f0f3ee]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-[#f0f2ee] pt-3">
            <p className="text-xs font-bold text-[#1f2924]">ความเข้มงวดตรวจข้อตอบสั้น</p>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {(
                [
                  { value: 'lenient', label: 'ผ่อนปรน' },
                  { value: 'normal', label: 'ปกติ' },
                  { value: 'strict', label: 'เข้มงวด' },
                ] as Array<{ value: ShortAnswerStrictness; label: string }>
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChangeConfig({ ...config, shortAnswerStrictness: opt.value })}
                  className={`h-8 rounded-lg border text-xs font-bold transition ${
                    strictness === opt.value
                      ? 'border-[#1c342b] bg-[#1c342b] text-white'
                      : 'border-[#e5e8e1] bg-[#fafbf9] text-[#55615a] hover:bg-[#f0f3ee]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="mt-2 rounded-xl bg-[#fafbf9] p-2.5 text-[11px] font-medium leading-relaxed text-[#5b6a5f]">
              {strictnessExample}
            </p>
          </div>

          <div className="border-t border-[#f0f2ee] pt-3 space-y-1 text-[11px] font-medium text-[#75827a]">
            <p className="font-bold text-[#1f2924]">ทางลัด</p>
            <p>
              <kbd className="rounded border px-1 py-0.5 text-[10px]">Enter</kbd> ในตัวเลือกสุดท้าย = เพิ่มตัวเลือก
            </p>
            <p>
              <kbd className="rounded border px-1 py-0.5 text-[10px]">K</kbd> = สลับเขียนโจทย์ / เฉลย
            </p>
            <p>
              <kbd className="rounded border px-1 py-0.5 text-[10px]">Esc</kbd> = ออกจากช่องที่กำลังพิมพ์
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
