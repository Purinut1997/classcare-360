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
  RotateCw,
  School,
  Sparkles,
  Upload,
  UserRound,
  X,
  ZoomIn,
} from 'lucide-react';
import { ContextLink as Link } from '../navigation/ContextLink';
import { getEffectiveAiConfig } from '../../lib/aiSettings';
import {
  compressImageForVision,
  parseScheduleImage,
  type ParsedScheduleCell,
  type ParsedScheduleResult,
} from '../../lib/aiVisionService';
import type { DayName } from '../../lib/scheduleSettings';
import type { AppSessionContext } from '../../types/core';

interface ScheduleOcrModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultClassroom: string;
  defaultTeacherName?: string;
  classroomOptions: string[];
  session: AppSessionContext;
  onApplySchedule: (result: ParsedScheduleResult, mode: 'replace' | 'merge') => void;
}

export function ScheduleOcrModal({
  isOpen,
  onClose,
  defaultClassroom,
  defaultTeacherName = '',
  classroomOptions,
  session,
  onApplySchedule,
}: ScheduleOcrModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [teacherName, setTeacherName] = useState(
    defaultTeacherName || session.profile?.displayName || ''
  );
  const [fallbackClassroom, setFallbackClassroom] = useState(defaultClassroom || 'ป.5/1');
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedScheduleResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  // Check API key availability when modal opens
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
    try {
      const compressed = await compressImageForVision(file);
      setSelectedFile(file);
      setPreviewUrl(compressed.previewUrl);
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  };

  const handleRotateImage = () => {
    if (!previewUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalHeight;
      canvas.height = img.naturalWidth;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((90 * Math.PI) / 180);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

      const mimeType = 'image/jpeg';
      const rotatedDataUrl = canvas.toDataURL(mimeType, 0.9);
      setPreviewUrl(rotatedDataUrl);

      try {
        const byteString = atob(rotatedDataUrl.split(',')[1]);
        const mimeString = rotatedDataUrl.split(',')[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: mimeString });
        const newFile = new File([blob], selectedFile?.name || 'schedule_rotated.jpg', {
          type: mimeString,
        });
        setSelectedFile(newFile);
      } catch {
        // Keep previewUrl if atob fails
      }
    };
    img.src = previewUrl;
  };

  const handleAnalyze = async () => {
    if (!previewUrl || !selectedFile) {
      setErrorMessage('กรุณาเลือกรูปภาพตารางสอนก่อน');
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
      const result = await parseScheduleImage(
        config.apiKey,
        config.model,
        compressed.base64,
        compressed.mimeType,
        fallbackClassroom,
        teacherName
      );

      if (result.cells.length === 0) {
        throw new Error('ไม่พบช่องตารางสอนที่ชัดเจนในภาพ กรุณาถ่ายภาพให้สว่างและตรงขึ้น');
      }

      if (result.teacherName?.trim()) {
        setTeacherName(result.teacherName.trim());
      }
      setParsedResult(result);
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirm = () => {
    if (!parsedResult) return;
    const finalResult: ParsedScheduleResult = {
      ...parsedResult,
      teacherName: teacherName.trim() || parsedResult.teacherName,
    };
    onApplySchedule(finalResult, importMode);
    onClose();
  };

  // Group cells by day for review
  const days: DayName[] = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'];
  const cellsByDay: Record<string, ParsedScheduleCell[]> = {};
  if (parsedResult) {
    for (const day of days) {
      cellsByDay[day] = parsedResult.cells
        .filter((c) => c.day === day)
        .sort((a, b) => a.periodIndex - b.periodIndex);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-amber-500/10 via-white to-transparent px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-white shadow-md">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">
                นำเข้าตารางสอนด้วย AI (Smart Timetable OCR)
              </h3>
              <p className="text-xs font-bold text-slate-500">
                ถ่ายภาพหรืออัปโหลดตารางสอนกระดาษ/รูปภาพ แล้วให้ AI วิเคราะห์ลงตารางอัตโนมัติ
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
          {/* Missing API Key Warning */}
          {hasApiKey === false && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <AlertCircle className="mt-0.5 shrink-0 text-amber-600" size={18} />
              <div>
                <p className="font-bold">ยังไม่ได้ตั้งค่า Gemini API Key</p>
                <p className="text-xs text-amber-700 mt-1">
                  ระบบ AI Vision จำเป็นต้องใช้ Gemini API Key (มีโควตาฟรีสูงสุด 1,500 ครั้ง/วัน) เพื่อประมวลผลรูปภาพ
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

          {/* Step 1: Upload / Capture */}
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
                  className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-amber-300 bg-amber-50/40 p-8 text-center transition hover:bg-amber-50/80 cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 shadow-sm">
                    <FileImage size={28} />
                  </div>
                  <p className="text-base font-black text-slate-900">
                    คลิกเพื่อเลือกรูปภาพ หรือถ่ายภาพตารางสอน
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    รองรับไฟล์ JPG, PNG, WEBP (ระบบจะปรับความคมชัดอัตโนมัติ)
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
                      <Upload size={14} /> เลือกไฟล์ภาพ
                    </button>
                    <button
                      className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-amber-700"
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
                <div className="relative rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-black text-slate-600">ภาพตารางสอนต้นฉบับ</span>
                    <div className="flex items-center gap-2">
                      <button
                        className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-800 shadow-xs hover:bg-amber-100 transition"
                        onClick={handleRotateImage}
                        title="หมุนภาพ 90 องศา (หากภาพถ่ายตะแคงข้าง)"
                        type="button"
                      >
                        <RotateCw size={13} className="text-amber-700" />
                        <span>หมุนภาพ 90°</span>
                      </button>
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
                  </div>
                  <div className="relative max-h-72 overflow-hidden rounded-2xl border border-slate-200 bg-white flex items-center justify-center">
                    <img
                      alt="ตารางสอนต้นฉบับ"
                      className="max-h-72 w-auto object-contain"
                      src={previewUrl}
                    />
                  </div>
                </div>
              )}

              {/* Settings for Teacher Schedule */}
              <div className="grid gap-3.5 rounded-2xl border border-amber-200/80 bg-amber-50/40 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-xs font-black text-slate-700">
                    <span className="flex items-center gap-1 text-amber-900 font-black">
                      <UserRound size={14} className="text-amber-700" />
                      ครูผู้สอน (เจ้าของตารางสอน)
                    </span>
                    <input
                      className="h-10 rounded-xl border border-slate-200 bg-white px-3 font-bold text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                      onChange={(e) => setTeacherName(e.target.value)}
                      placeholder="เช่น ครูสมชาย ใจดี"
                      value={teacherName}
                    />
                    <span className="text-[11px] font-medium text-slate-500">
                      ตารางสอนฉบับนี้เป็นของครูผู้สอนท่านนี้
                    </span>
                  </label>

                  <label className="grid gap-1 text-xs font-black text-slate-700">
                    <span className="flex items-center gap-1 text-slate-700 font-black">
                      <School size={14} className="text-amber-700" />
                      ห้องเรียนประจำชั้น / ห้องเริ่มต้น
                    </span>
                    <select
                      className="h-10 rounded-xl border border-slate-200 bg-white px-3 font-bold text-slate-900 focus:border-amber-500"
                      onChange={(e) => setFallbackClassroom(e.target.value)}
                      value={fallbackClassroom}
                    >
                      {classroomOptions.map((room) => (
                        <option key={room} value={room}>
                          {room}
                        </option>
                      ))}
                    </select>
                    <span className="text-[11px] font-medium text-slate-500">
                      AI จะตรวจจับห้องที่สอนในแต่ละคาบให้ (หากช่องใดในภาพไม่ระบุห้อง จะใช้ห้องนี้)
                    </span>
                  </label>
                </div>

                <div className="border-t border-amber-200/60 pt-3">
                  <span className="text-xs font-black text-slate-700 block mb-1.5">รูปแบบการนำเข้า</span>
                  <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-700">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        checked={importMode === 'replace'}
                        name="importMode"
                        onChange={() => setImportMode('replace')}
                        type="radio"
                      />
                      <span>แทนที่ตารางเดิมทั้งหมด</span>
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        checked={importMode === 'merge'}
                        name="importMode"
                        onChange={() => setImportMode('merge')}
                        type="radio"
                      />
                      <span>รวมเฉพาะช่องใหม่</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Review Result */}
          {parsedResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-2xl bg-teal-50 border border-teal-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-teal-950">
                      วิเคราะห์สำเร็จ! ตรวจพบ {parsedResult.cells.length} คาบเรียน (
                      {parsedResult.subjects.length} รายวิชา)
                    </h4>
                    <p className="text-xs text-teal-700">
                      ครูผู้สอน: <span className="font-bold">{teacherName || 'ไม่ระบุ'}</span> • {parsedResult.courseTitle || 'ตารางสอนประจำสัปดาห์'} • {parsedResult.periodCount} คาบ/วัน
                    </p>
                  </div>
                </div>
                <button
                  className="inline-flex items-center gap-1.5 rounded-xl border border-teal-300 bg-white px-3 py-1.5 text-xs font-bold text-teal-900 hover:bg-teal-50"
                  onClick={() => setParsedResult(null)}
                  type="button"
                >
                  <RefreshCw size={13} /> สแกนใหม่
                </button>
              </div>

              {/* Parsed Table Grid Preview */}
              <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
                <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-xs font-black text-slate-600">
                  ตารางสรุปผลลัพธ์ที่ตรวจพบ (จันทร์–ศุกร์)
                </div>
                <div className="divide-y divide-slate-100">
                  {days.map((day) => {
                    const dayCells = cellsByDay[day] || [];
                    return (
                      <div className="grid grid-cols-[80px_1fr] items-center p-3 gap-2" key={day}>
                        <div className="text-xs font-black text-slate-800 bg-slate-100 rounded-lg p-1.5 text-center">
                          {day}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {dayCells.length === 0 ? (
                            <span className="text-xs text-slate-400 italic">ไม่มีข้อมูลคาบเรียน</span>
                          ) : (
                            dayCells.map((c) => (
                              <div
                                className="rounded-xl border border-amber-200 bg-amber-50/80 px-2.5 py-1 text-xs font-bold text-amber-950 shadow-xs flex items-center gap-1.5"
                                key={`${c.day}-${c.periodIndex}`}
                              >
                                <span className="font-mono text-amber-700">คาบ {c.periodIndex}:</span>
                                <span className="font-black">{c.subjectName}</span>
                                {c.subjectCode ? (
                                  <span className="text-[10px] text-amber-600 font-mono">({c.subjectCode})</span>
                                ) : null}
                                {c.classroom ? (
                                  <span className="rounded-md bg-amber-200/80 px-1.5 py-0.5 text-[10px] font-black text-amber-900">
                                    ห้อง {c.classroom}
                                  </span>
                                ) : null}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Detected Subjects Catalog */}
              {parsedResult.subjects.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5">
                  <p className="text-xs font-black text-slate-700 mb-2">
                    รายวิชาที่ตรวจพบและจะเพิ่มเข้าแค็ตตาล็อกรายวิชา ({parsedResult.subjects.length} วิชา):
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {parsedResult.subjects.map((sub, idx) => (
                      <span
                        className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-slate-700 border border-slate-200 shadow-xs"
                        key={idx}
                      >
                        {sub.code ? `${sub.code} ` : ''}
                        {sub.name}
                      </span>
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
            ยกเลิก
          </button>

          {!parsedResult ? (
            <button
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 px-6 py-3 text-xs font-black text-white shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
              disabled={!previewUrl || isProcessing || hasApiKey === false}
              onClick={handleAnalyze}
              type="button"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin text-white" size={16} />
                  <span>กำลังให้ AI Vision วิเคราะห์ตารางสอน...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} className="text-yellow-200 animate-pulse" />
                  <span>✨ วิเคราะห์ตารางสอนด้วย AI Vision</span>
                  <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider backdrop-blur-xs border border-white/25">AI</span>
                </>
              )}
            </button>
          ) : (
            <button
              className="inline-flex items-center gap-2 rounded-2xl bg-teal-600 px-5 py-2.5 text-xs font-black text-white shadow-md hover:bg-teal-700"
              onClick={handleConfirm}
              type="button"
            >
              <Check size={16} />
              <span>ยืนยันและนำเข้าสู่ตารางสอน</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
