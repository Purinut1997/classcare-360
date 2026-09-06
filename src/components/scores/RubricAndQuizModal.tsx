import { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  FileCheck2,
  GraduationCap,
  HelpCircle,
  Layers,
  Lightbulb,
  Loader2,
  Printer,
  Sparkles,
  X,
} from 'lucide-react';
import { ContextLink as Link } from '../navigation/ContextLink';
import { getEffectiveAiConfig } from '../../lib/aiSettings';
import {
  generateRemedialQuiz,
  generateRubricCriteria,
  type RemedialQuizResult,
  type RubricResult,
} from '../../lib/aiVisionService';
import type { AppSessionContext } from '../../types/core';

interface RubricAndQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSubject: string;
  defaultGradeLevel?: string;
  session: AppSessionContext;
}

type ActiveTab = 'rubric' | 'quiz';

export function RubricAndQuizModal({
  isOpen,
  onClose,
  defaultSubject,
  defaultGradeLevel = 'ป.5',
  session,
}: RubricAndQuizModalProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('rubric');
  const [subject, setSubject] = useState(defaultSubject || 'คณิตศาสตร์');
  const [gradeLevel, setGradeLevel] = useState(defaultGradeLevel);
  const [indicator, setIndicator] = useState('ค 1.1 ป.5/1');
  const [taskDescription, setTaskDescription] = useState('การแก้โจทย์ปัญหาเศษส่วนและจำนวนคละ 2 ขั้นตอน');
  const [focusTopics, setFocusTopics] = useState('การบวก ลบ เศษส่วนที่ตัวส่วนไม่เท่ากัน');
  const [questionCount, setQuestionCount] = useState(5);

  const [isGenerating, setIsGenerating] = useState(false);
  const [rubricResult, setRubricResult] = useState<RubricResult | null>(null);
  const [quizResult, setQuizResult] = useState<RemedialQuizResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  const checkApiKey = async () => {
    try {
      const config = await getEffectiveAiConfig(session);
      setHasApiKey(Boolean(config.apiKey));
    } catch {
      setHasApiKey(false);
    }
  };

  if (!isOpen) return null;
  if (hasApiKey === null) {
    void checkApiKey();
  }

  const handleGenerateRubric = async () => {
    setIsGenerating(true);
    setErrorMessage(null);
    try {
      const config = await getEffectiveAiConfig(session);
      if (!config.apiKey) {
        throw new Error('ไม่พบ Gemini API Key ในระบบ กรุณาตั้งค่าก่อนใช้งาน');
      }
      const res = await generateRubricCriteria(
        config.apiKey,
        config.model,
        subject,
        gradeLevel,
        indicator,
        taskDescription
      );
      setRubricResult(res);
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateQuiz = async () => {
    setIsGenerating(true);
    setErrorMessage(null);
    try {
      const config = await getEffectiveAiConfig(session);
      if (!config.apiKey) {
        throw new Error('ไม่พบ Gemini API Key ในระบบ กรุณาตั้งค่าก่อนใช้งาน');
      }
      const res = await generateRemedialQuiz(
        config.apiKey,
        config.model,
        subject,
        gradeLevel,
        indicator,
        focusTopics,
        questionCount
      );
      setQuizResult(res);
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopyNotice(`คัดลอก ${label} ลงคลิปบอร์ดแล้ว`);
    setTimeout(() => setCopyNotice(null), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-violet-500/10 via-white to-transparent px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-violet-400 text-white shadow-md">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">
                ✨ ตัวช่วยออกแบบการประเมิน & รูบริก (Rubric & Remedial Quiz Generator)
              </h3>
              <p className="text-xs font-bold text-slate-500">
                ออกแบบเกณฑ์การให้คะแนน 4 ระดับ และสร้างข้อสอบซ่อมเสริมตามตัวชี้วัด สพฐ. ในคลิกเดียว
              </p>
            </div>
          </div>
          <button
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            onClick={onClose}
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-100 bg-slate-50/70 px-6">
          <button
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-black transition ${
              activeTab === 'rubric'
                ? 'border-violet-600 text-violet-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
            onClick={() => {
              setActiveTab('rubric');
              setErrorMessage(null);
            }}
            type="button"
          >
            <FileCheck2 size={16} />
            <span>1. เกณฑ์รูบริก 4 ระดับ (Rubric Criteria)</span>
          </button>
          <button
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-black transition ${
              activeTab === 'quiz'
                ? 'border-violet-600 text-violet-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
            onClick={() => {
              setActiveTab('quiz');
              setErrorMessage(null);
            }}
            type="button"
          >
            <GraduationCap size={16} />
            <span>2. ข้อสอบซ่อมเสริมเฉพาะจุด (Remedial Quiz)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Missing API Key Warning */}
          {hasApiKey === false && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <AlertCircle className="mt-0.5 shrink-0 text-amber-600" size={18} />
              <div>
                <p className="font-bold">ยังไม่ได้ตั้งค่า Gemini API Key</p>
                <p className="text-xs text-amber-700 mt-1">
                  ระบบต้องการ Gemini API Key เพื่อสร้างเกณฑ์และแบบทดสอบซ่อมเสริม
                </p>
                <Link
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-black text-amber-800 underline hover:text-amber-950"
                  to="/app/dashboard?view=workspace-settings"
                >
                  ไปที่หน้าตั้งค่าระบบเพื่อใส่ API Key <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          )}

          {copyNotice && (
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 animate-in fade-in">
              <CheckCircle2 size={15} className="text-emerald-600" />
              <span>{copyNotice}</span>
            </div>
          )}

          {errorMessage && (
            <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-bold text-rose-800">
              <AlertCircle className="shrink-0 text-rose-600" size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form Inputs */}
          <div className="grid gap-3 sm:grid-cols-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <label className="grid gap-1.5 text-xs font-black text-slate-700">
              วิชา
              <input
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 font-bold text-slate-900"
                onChange={(e) => setSubject(e.target.value)}
                placeholder="เช่น คณิตศาสตร์"
                value={subject}
              />
            </label>
            <label className="grid gap-1.5 text-xs font-black text-slate-700">
              ระดับชั้น
              <input
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 font-bold text-slate-900"
                onChange={(e) => setGradeLevel(e.target.value)}
                placeholder="เช่น ป.5 หรือ ม.2"
                value={gradeLevel}
              />
            </label>
            <label className="grid gap-1.5 text-xs font-black text-slate-700">
              ตัวชี้วัด สพฐ.
              <input
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 font-bold text-slate-900"
                onChange={(e) => setIndicator(e.target.value)}
                placeholder="เช่น ค 1.1 ป.5/1 หรือ ว 1.2 ม.2/1"
                value={indicator}
              />
            </label>
          </div>

          {/* TAB 1: Rubric Generator */}
          {activeTab === 'rubric' && (
            <div className="space-y-4">
              <label className="grid gap-1.5 text-xs font-black text-slate-700">
                ลักษณะงาน / ชิ้นงานที่จะประเมิน
                <input
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 font-bold text-slate-900"
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="เช่น ใบงานการแก้โจทย์ปัญหา, รายงานการทดลองวิทยาศาสตร์, การเขียนเรียงความ"
                  value={taskDescription}
                />
              </label>

              {!rubricResult ? (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-violet-300 bg-violet-50/30 p-8 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                    <FileCheck2 size={24} />
                  </div>
                  <p className="text-sm font-black text-slate-900">
                    คลิกปุ่มด้านล่างเพื่อสร้างเกณฑ์ Rubrics 4 ระดับ (สพฐ.) อัตโนมัติ
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    ระดับ 4 (ดีเยี่ยม), ระดับ 3 (ดี), ระดับ 2 (พอใช้/ผ่าน), ระดับ 1 (ปรับปรุง)
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-base font-black text-slate-900">{rubricResult.title}</h4>
                      <p className="text-xs text-slate-500">
                        {rubricResult.subject} • {rubricResult.indicator}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50"
                        onClick={() => {
                          const formatted = rubricResult.criteria
                            .map((c) => `[${c.dimension}]\n` + c.levels.map((l) => `- ระดับ ${l.level} (${l.label}): ${l.description}`).join('\n'))
                            .join('\n\n');
                          handleCopyText(`${rubricResult.title}\nตัวชี้วัด: ${rubricResult.indicator}\n\n${formatted}`, 'เกณฑ์รูบริก');
                        }}
                        type="button"
                      >
                        <Copy size={13} /> คัดลอก
                      </button>
                    </div>
                  </div>

                  {/* Rubric Table */}
                  <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 font-black text-slate-700">
                            <th className="p-3 w-40">ประเด็นการประเมิน</th>
                            <th className="p-3 bg-emerald-50 text-emerald-900">ระดับ 4 (ดีเยี่ยม)</th>
                            <th className="p-3 bg-teal-50 text-teal-900">ระดับ 3 (ดี)</th>
                            <th className="p-3 bg-blue-50 text-blue-900">ระดับ 2 (พอใช้)</th>
                            <th className="p-3 bg-rose-50 text-rose-900">ระดับ 1 (ปรับปรุง)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {rubricResult.criteria.map((crit, idx) => (
                            <tr className="align-top" key={idx}>
                              <td className="p-3 font-bold text-slate-900 bg-slate-50/50">
                                <p>{crit.dimension}</p>
                                {crit.weight ? (
                                  <span className="text-[10px] text-slate-500 font-normal">
                                    น้ำหนัก: {crit.weight}
                                  </span>
                                ) : null}
                              </td>
                              {crit.levels.map((lvl) => (
                                <td className="p-3 leading-relaxed text-slate-700" key={lvl.level}>
                                  {lvl.description}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {rubricResult.scoringGuidance ? (
                    <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-3.5 text-xs text-violet-900">
                      <span className="font-bold">💡 คำแนะนำการให้คะแนน: </span>
                      <span>{rubricResult.scoringGuidance}</span>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Remedial Quiz Generator */}
          {activeTab === 'quiz' && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                <label className="grid gap-1.5 text-xs font-black text-slate-700">
                  หัวข้อหรือเนื้อหาที่นักเรียนทำผิดบ่อย (ซ่อมเสริมเฉพาะจุด)
                  <input
                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 font-bold text-slate-900"
                    onChange={(e) => setFocusTopics(e.target.value)}
                    placeholder="เช่น การบวกเศษส่วนที่ตัวส่วนไม่เท่ากัน"
                    value={focusTopics}
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-black text-slate-700">
                  จำนวนข้อ
                  <select
                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 font-bold text-slate-900"
                    onChange={(e) => setQuestionCount(Number(e.target.value))}
                    value={questionCount}
                  >
                    <option value={3}>3 ข้อ</option>
                    <option value={5}>5 ข้อ</option>
                    <option value={10}>10 ข้อ</option>
                  </select>
                </label>
              </div>

              {!quizResult ? (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-violet-300 bg-violet-50/30 p-8 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                    <GraduationCap size={24} />
                  </div>
                  <p className="text-sm font-black text-slate-900">
                    คลิกปุ่มด้านล่างเพื่อสร้างชุดข้อสอบซ่อมเสริมพร้อมเฉลยละเอียด
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    AI จะสร้างข้อสอบ 4 ตัวเลือก (ก, ข, ค, ง) ที่ตรงกับตัวชี้วัด สพฐ. เพื่อให้นักเรียนทำซ่อมได้ทันที
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-base font-black text-slate-900">{quizResult.title}</h4>
                      <p className="text-xs text-slate-500">
                        {quizResult.subject} • {quizResult.indicator}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50"
                        onClick={() => {
                          const formatted = quizResult.questions
                            .map((q) => `${q.questionNumber}. ${q.questionText}\n` + q.choices.map((c) => `   ${c.key}. ${c.text}`).join('\n') + `\n   เฉลย: ${q.correctAnswer} (${q.explanation})`)
                            .join('\n\n');
                          handleCopyText(`${quizResult.title}\n${quizResult.instructions}\n\n${formatted}`, 'ข้อสอบซ่อมเสริม');
                        }}
                        type="button"
                      >
                        <Copy size={13} /> คัดลอกทั้งหมด
                      </button>
                    </div>
                  </div>

                  {/* Questions List */}
                  <div className="space-y-3">
                    {quizResult.questions.map((q) => (
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs" key={q.questionNumber}>
                        <p className="text-sm font-black text-slate-900">
                          {q.questionNumber}. {q.questionText}
                        </p>
                        <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {q.choices.map((c) => {
                            const isCorrect = c.key === q.correctAnswer;
                            return (
                              <div
                                className={`flex items-center gap-2 rounded-xl p-2 text-xs font-bold transition ${
                                  isCorrect
                                    ? 'border border-emerald-300 bg-emerald-50 text-emerald-950 font-black'
                                    : 'border border-slate-200 bg-slate-50/60 text-slate-700'
                                }`}
                                key={c.key}
                              >
                                <span
                                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-black ${
                                    isCorrect
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-white text-slate-600 ring-1 ring-slate-200'
                                  }`}
                                >
                                  {c.key}
                                </span>
                                <span>{c.text}</span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-3 rounded-xl bg-slate-50 p-2.5 text-xs text-slate-600">
                          <span className="font-black text-emerald-700">เฉลย: ข้อ {q.correctAnswer}</span>
                          <span className="mx-1.5">•</span>
                          <span>{q.explanation}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button
            className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200"
            onClick={onClose}
            type="button"
          >
            ปิดหน้าต่าง
          </button>

          {activeTab === 'rubric' ? (
            <button
              className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-5 py-2.5 text-xs font-black text-white shadow-md hover:bg-violet-700 disabled:opacity-50"
              disabled={isGenerating || hasApiKey === false}
              onClick={handleGenerateRubric}
              type="button"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span>กำลังออกแบบเกณฑ์ Rubrics...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>{rubricResult ? 'สร้างเกณฑ์ใหม่' : 'ออกแบบเกณฑ์ Rubrics 4 ระดับ'}</span>
                </>
              )}
            </button>
          ) : (
            <button
              className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-5 py-2.5 text-xs font-black text-white shadow-md hover:bg-violet-700 disabled:opacity-50"
              disabled={isGenerating || hasApiKey === false}
              onClick={handleGenerateQuiz}
              type="button"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span>กำลังสร้างข้อสอบซ่อมเสริม...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>{quizResult ? 'สร้างข้อสอบชุดใหม่' : `สร้างข้อสอบซ่อมเสริม ${questionCount} ข้อ`}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
