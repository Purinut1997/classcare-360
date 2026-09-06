import { useState, useRef } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  FileImage,
  Loader2,
  RefreshCw,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { ContextLink as Link } from '../navigation/ContextLink';
import { getEffectiveAiConfig } from '../../lib/aiSettings';
import {
  compressImageForVision,
  parseScoreSheetImage,
  type ParsedScoreResult,
  type ParsedScoreStudent,
} from '../../lib/aiVisionService';
import type { AppSessionContext } from '../../types/core';

interface ScoreOcrModalProps {
  isOpen: boolean;
  onClose: () => void;
  assessmentTitle: string;
  maxScore: number;
  students: Array<{ id: string; student_code: string | null; name: string; number?: number }>;
  session: AppSessionContext;
  onApplyScores: (scores: Record<string, number | null>) => void;
}

export function ScoreOcrModal({
  isOpen,
  onClose,
  assessmentTitle,
  maxScore,
  students,
  session,
  onApplyScores,
}: ScoreOcrModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedScoreResult | null>(null);
  const [editableScores, setEditableScores] = useState<Record<string, number | null>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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

  const handleFileChange = async (file: File) => {
    setErrorMessage(null);
    setParsedResult(null);
    setEditableScores({});
    try {
      const compressed = await compressImageForVision(file);
      setSelectedFile(file);
      setPreviewUrl(compressed.previewUrl);
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      setErrorMessage('กรุณาเลือกรูปภาพใบคะแนนก่อน');
      return;
    }

    if (students.length === 0) {
      setErrorMessage('ไม่พบรายชื่อนักเรียนในห้องเรียนนี้เพื่อใช้เทียบเคียง');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const config = await getEffectiveAiConfig(session);
      if (!config.apiKey) {
        throw new Error('ไม่พบ Gemini API Key ในระบบ กรุณาตั้งค่าก่อนใช้งาน');
      }

      const compressed = await compressImageForVision(selectedFile);
      const result = await parseScoreSheetImage(
        config.apiKey,
        config.model,
        compressed.base64,
        compressed.mimeType,
        maxScore,
        students
      );

      const scoreMap: Record<string, number | null> = {};
      result.students.forEach((s) => {
        scoreMap[s.studentId] = s.score !== null ? Math.min(maxScore, Math.max(0, s.score)) : null;
      });

      setParsedResult(result);
      setEditableScores(scoreMap);
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleScoreChange = (studentId: string, valStr: string) => {
    if (valStr.trim() === '') {
      setEditableScores((prev) => ({ ...prev, [studentId]: null }));
      return;
    }
    const num = Number(valStr);
    if (!Number.isNaN(num)) {
      setEditableScores((prev) => ({
        ...prev,
        [studentId]: Math.min(maxScore, Math.max(0, num)),
      }));
    }
  };

  const handleConfirm = () => {
    onApplyScores(editableScores);
    onClose();
  };

  const validScores = Object.values(editableScores).filter((v): v is number => v !== null && v !== undefined);
  const filledCount = validScores.length;
  const averageScore =
    filledCount > 0
      ? (validScores.reduce((acc, curr) => acc + curr, 0) / filledCount).toFixed(1)
      : '0';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-indigo-500/10 via-white to-transparent px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-400 text-white shadow-md">
              <Camera size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">
                📸 สแกนใบคะแนนกระดาษด้วย AI (Smart Score OCR)
              </h3>
              <p className="text-xs font-bold text-slate-500">
                ถ่ายภาพใบคะแนนสอบ/ใบงานเก็บคะแนน แล้วให้ AI ดึงคะแนนรายคนลงช่องอัตโนมัติ
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

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Info Banner */}
          <div className="flex items-center justify-between rounded-2xl bg-indigo-50/70 border border-indigo-100 p-3.5 text-xs font-bold text-indigo-950">
            <div>
              <span>ชิ้นงานเป้าหมาย: </span>
              <span className="font-black text-indigo-800">{assessmentTitle || 'ชิ้นงานเก็บคะแนน'}</span>
            </div>
            <span className="rounded-xl bg-white px-2.5 py-1 text-indigo-700 ring-1 ring-indigo-200 font-mono">
              คะแนนเต็ม: {maxScore} คะแนน
            </span>
          </div>

          {/* Missing API Key Warning */}
          {hasApiKey === false && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <AlertCircle className="mt-0.5 shrink-0 text-amber-600" size={18} />
              <div>
                <p className="font-bold">ยังไม่ได้ตั้งค่า Gemini API Key</p>
                <p className="text-xs text-amber-700 mt-1">
                  ระบบต้องการ Gemini API Key เพื่อถอดรหัสตัวเลขคะแนนจากภาพถ่าย
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

          {/* Error Message */}
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-bold text-rose-800">
              <AlertCircle className="shrink-0 text-rose-600" size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Upload Stage */}
          {!parsedResult && (
            <div className="space-y-4">
              <input
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileChange(file);
                }}
                ref={fileInputRef}
                type="file"
              />

              {!previewUrl ? (
                <div
                  className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-indigo-300 bg-indigo-50/40 p-8 text-center transition hover:bg-indigo-50/80 cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 shadow-sm">
                    <FileImage size={28} />
                  </div>
                  <p className="text-base font-black text-slate-900">
                    คลิกเพื่อเลือกภาพ หรือถ่ายภาพกระดาษจดคะแนน
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    ถ่ายภาพตารางคะแนนเก็บ สมุดตรวจงาน หรือใบตรวจข้อสอบที่มีเลขที่/ชื่อและตัวเลขคะแนน
                  </p>
                  <div className="mt-4 flex gap-2">
                    <button
                      className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      type="button"
                    >
                      <Upload size={14} /> เลือกไฟล์รูปภาพ
                    </button>
                    <button
                      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-indigo-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      type="button"
                    >
                      <Camera size={14} /> ถ่ายภาพด้วยกล้อง
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-black text-slate-600">รูปภาพใบคะแนนที่เลือก</span>
                    <button
                      className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:underline"
                      onClick={() => {
                        setSelectedFile(null);
                        setPreviewUrl(null);
                      }}
                      type="button"
                    >
                      <X size={14} /> ลบและเลือกภาพใหม่
                    </button>
                  </div>
                  <div className="relative max-h-72 overflow-hidden rounded-2xl border border-slate-200 bg-white flex items-center justify-center">
                    <img
                      alt="ใบคะแนนต้นฉบับ"
                      className="max-h-72 w-auto object-contain"
                      src={previewUrl}
                    />
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                <p className="text-xs font-black text-slate-700">
                  นักเรียนในห้องที่จะแมปคะแนน: <span className="text-indigo-700">{students.length} คน</span>
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  ระบบจะอ่านตัวเลขคะแนนและตัดเกณฑ์ไม่ให้เกิน {maxScore} คะแนนโดยอัตโนมัติ
                </p>
              </div>
            </div>
          )}

          {/* Review Stage */}
          {parsedResult && (
            <div className="space-y-4">
              {/* Stat Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-3 text-center">
                  <p className="text-xl font-black text-indigo-900">{filledCount} / {students.length}</p>
                  <p className="text-xs font-bold text-indigo-700">ตรวจพบคะแนน</p>
                </div>
                <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-3 text-center">
                  <p className="text-xl font-black text-teal-900">{averageScore}</p>
                  <p className="text-xs font-bold text-teal-700">คะแนนเฉลี่ย</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3 text-center">
                  <p className="text-xl font-black text-slate-900">{maxScore}</p>
                  <p className="text-xs font-bold text-slate-600">คะแนนเต็ม</p>
                </div>
              </div>

              {/* Editable Score List */}
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5 flex items-center justify-between text-xs font-black text-slate-600">
                  <span>ตรวจทานและแก้ไขคะแนนรายคน (คะแนนเต็ม {maxScore})</span>
                  <button
                    className="inline-flex items-center gap-1 text-indigo-700 hover:underline"
                    onClick={() => setParsedResult(null)}
                    type="button"
                  >
                    <RefreshCw size={12} /> สแกนใหม่
                  </button>
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {students.map((s, idx) => {
                    const val = editableScores[s.id];
                    return (
                      <div
                        className="flex items-center justify-between p-3 gap-3 hover:bg-slate-50/80 transition"
                        key={s.id}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-black text-slate-600">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-black text-slate-900 truncate">{s.name}</p>
                            {s.student_code ? (
                              <span className="text-[11px] font-mono text-slate-400">{s.student_code}</span>
                            ) : null}
                          </div>
                        </div>

                        {/* Score Input */}
                        <div className="flex items-center gap-2 shrink-0">
                          <input
                            className="h-9 w-20 rounded-xl border border-slate-300 bg-white text-center font-mono text-sm font-black text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            max={maxScore}
                            min={0}
                            onChange={(e) => handleScoreChange(s.id, e.target.value)}
                            placeholder="-"
                            step="0.5"
                            type="number"
                            value={val !== null && val !== undefined ? val : ''}
                          />
                          <span className="text-xs text-slate-400 font-bold">/ {maxScore}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
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
            ยกเลิก
          </button>

          {!parsedResult ? (
            <button
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 px-6 py-3 text-xs font-black text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
              disabled={!previewUrl || isProcessing || hasApiKey === false}
              onClick={handleAnalyze}
              type="button"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin text-amber-300" size={16} />
                  <span>กำลังให้ AI Vision ถอดรหัสคะแนน...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} className="text-amber-300 animate-pulse" />
                  <span>✨ ถอดรหัสคะแนนด้วย AI Vision</span>
                  <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider backdrop-blur-xs border border-white/25">AI</span>
                </>
              )}
            </button>
          ) : (
            <button
              className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-xs font-black text-white shadow-md hover:bg-indigo-700"
              onClick={handleConfirm}
              type="button"
            >
              <Check size={16} />
              <span>ยืนยันและนำคะแนนเข้าสู่ระบบ ({filledCount} คน)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
