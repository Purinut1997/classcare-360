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
  UserCheck,
  X,
} from 'lucide-react';
import { ContextLink as Link } from '../navigation/ContextLink';
import { getEffectiveAiConfig } from '../../lib/aiSettings';
import {
  compressImageForVision,
  parseAttendanceImage,
  type ParsedAttendanceResult,
  type ParsedAttendanceStudent,
} from '../../lib/aiVisionService';
import type { AppSessionContext } from '../../types/core';

type AttendanceStatus = 'present' | 'absent' | 'late' | 'leave' | 'sick' | 'activity';

interface AttendanceOcrModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Array<{ id: string; student_code: string | null; name: string; number?: number }>;
  session: AppSessionContext;
  onApplyAttendance: (records: Record<string, { status: AttendanceStatus; note?: string | null }>) => void;
}

const statusOptions: Array<{ label: string; tone: string; value: AttendanceStatus }> = [
  { label: 'มา', tone: 'bg-teal-50 text-teal-700 ring-teal-200 border-teal-200', value: 'present' },
  { label: 'ขาด', tone: 'bg-rose-50 text-rose-700 ring-rose-200 border-rose-200', value: 'absent' },
  { label: 'สาย', tone: 'bg-amber-50 text-amber-700 ring-amber-200 border-amber-200', value: 'late' },
  { label: 'ลา', tone: 'bg-sky-50 text-sky-700 ring-sky-200 border-sky-200', value: 'leave' },
  { label: 'ป่วย', tone: 'bg-violet-50 text-violet-700 ring-violet-200 border-violet-200', value: 'sick' },
  { label: 'กิจกรรม', tone: 'bg-lime-50 text-lime-700 ring-lime-200 border-lime-200', value: 'activity' },
];

export function AttendanceOcrModal({
  isOpen,
  onClose,
  students,
  session,
  onApplyAttendance,
}: AttendanceOcrModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedAttendanceResult | null>(null);
  const [editableStudents, setEditableStudents] = useState<ParsedAttendanceStudent[]>([]);
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
    setEditableStudents([]);
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
      setErrorMessage('กรุณาเลือกรูปภาพใบเช็คชื่อก่อน');
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
      const result = await parseAttendanceImage(
        config.apiKey,
        config.model,
        compressed.base64,
        compressed.mimeType,
        students
      );

      // Create mapping for all students, defaulting missing ones to 'present' with low confidence
      const recognizedMap = new Map(result.students.map((s) => [s.studentId, s]));
      const fullList: ParsedAttendanceStudent[] = students.map((std, idx) => {
        const found = recognizedMap.get(std.id);
        if (found) return found;
        return {
          studentId: std.id,
          studentCode: std.student_code || undefined,
          studentName: std.name,
          status: 'present',
          confidence: 'low',
          note: 'ไม่พบเครื่องหมายชัดเจน (ตั้งค่าเป็น มา อัตโนมัติ)',
        };
      });

      setParsedResult(result);
      setEditableStudents(fullList);
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const updateStudentStatus = (studentId: string, nextStatus: AttendanceStatus) => {
    setEditableStudents((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, status: nextStatus, confidence: 'high' } : s))
    );
  };

  const handleConfirm = () => {
    const recordsToApply: Record<string, { status: AttendanceStatus; note?: string | null }> = {};
    editableStudents.forEach((s) => {
      recordsToApply[s.studentId] = {
        status: s.status,
        note: s.note ? `[AI OCR] ${s.note}` : null,
      };
    });
    onApplyAttendance(recordsToApply);
    onClose();
  };

  // Summary counts
  const presentCount = editableStudents.filter((s) => s.status === 'present').length;
  const absentCount = editableStudents.filter((s) => s.status === 'absent').length;
  const lateCount = editableStudents.filter((s) => s.status === 'late').length;
  const leaveCount = editableStudents.filter((s) => s.status === 'leave' || s.status === 'sick').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-teal-500/10 via-white to-transparent px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-teal-600 to-teal-400 text-white shadow-md">
              <UserCheck size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">
                📸 สแกนใบเช็คชื่อกระดาษด้วย AI (Smart Attendance OCR)
              </h3>
              <p className="text-xs font-bold text-slate-500">
                ถ่ายภาพใบเช็คแถวหรือสมุดเช็คชื่อกระดาษ แล้วให้ AI แปลงสถานะ มา/ขาด/สาย/ลา อัตโนมัติ
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
                  ระบบต้องการ Gemini API Key เพื่อตรวจจับการเช็คชื่อจากรูปถ่าย
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

          {/* Upload / Capture Stage */}
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
                  className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-teal-300 bg-teal-50/40 p-8 text-center transition hover:bg-teal-50/80 cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-100 text-teal-700 shadow-sm">
                    <FileImage size={28} />
                  </div>
                  <p className="text-base font-black text-slate-900">
                    คลิกเพื่อเลือกรูป หรือถ่ายรูปใบเช็คชื่อกระดาษ
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    รองรับภาพถ่ายใบเช็คชื่อแถว สมุดเช็คชื่อครูประจำวิชา หรือกระดาษติ๊กชื่อ (JPG, PNG)
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
                      className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-teal-700"
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
                    <span className="text-xs font-black text-slate-600">รูปภาพใบเช็คชื่อที่เลือก</span>
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
                      alt="ใบเช็คชื่อต้นฉบับ"
                      className="max-h-72 w-auto object-contain"
                      src={previewUrl}
                    />
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                <p className="text-xs font-black text-slate-700">
                  นักเรียนในห้องปัจจุบันที่จะนำมาเทียบเคียง: <span className="text-teal-700">{students.length} คน</span>
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  AI จะวิเคราะห์จับคู่เลขที่และชื่อนักเรียนจากภาพถ่ายกระดาษเข้ากับรายชื่อในระบบโดยอัตโนมัติ
                </p>
              </div>
            </div>
          )}

          {/* Review Stage */}
          {parsedResult && (
            <div className="space-y-4">
              {/* Summary stat cards */}
              <div className="grid grid-cols-4 gap-2">
                <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-3 text-center">
                  <p className="text-xl font-black text-teal-900">{presentCount}</p>
                  <p className="text-xs font-bold text-teal-700">มาเรียน</p>
                </div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-3 text-center">
                  <p className="text-xl font-black text-rose-900">{absentCount}</p>
                  <p className="text-xs font-bold text-rose-700">ขาดเรียน</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3 text-center">
                  <p className="text-xl font-black text-amber-900">{lateCount}</p>
                  <p className="text-xs font-bold text-amber-700">มาสาย</p>
                </div>
                <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-3 text-center">
                  <p className="text-xl font-black text-sky-900">{leaveCount}</p>
                  <p className="text-xs font-bold text-sky-700">ลา / ป่วย</p>
                </div>
              </div>

              {/* Editable Attendance List */}
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5 flex items-center justify-between text-xs font-black text-slate-600">
                  <span>ตรวจทานผลการเช็คชื่อ ({editableStudents.length} คน) • คลิกเปลี่ยนสถานะได้ทันที</span>
                  <button
                    className="inline-flex items-center gap-1 text-teal-700 hover:underline"
                    onClick={() => setParsedResult(null)}
                    type="button"
                  >
                    <RefreshCw size={12} /> สแกนใหม่
                  </button>
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {editableStudents.map((s, idx) => (
                    <div
                      className="flex items-center justify-between p-3 gap-3 hover:bg-slate-50/80 transition"
                      key={s.studentId}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-black text-slate-600">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-900 truncate">{s.studentName}</p>
                          <div className="flex items-center gap-2">
                            {s.studentCode ? (
                              <span className="text-[11px] font-mono text-slate-400">{s.studentCode}</span>
                            ) : null}
                            {s.confidence === 'low' && (
                              <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                                ตรวจสอบ
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status Pills Selector */}
                      <div className="flex items-center gap-1 shrink-0">
                        {statusOptions.map((opt) => {
                          const isSelected = s.status === opt.value;
                          return (
                            <button
                              className={`rounded-xl px-2.5 py-1 text-xs font-black transition ${
                                isSelected
                                  ? `${opt.tone} ring-2 ring-offset-1`
                                  : 'text-slate-400 hover:bg-slate-100'
                              }`}
                              key={opt.value}
                              onClick={() => updateStudentStatus(s.studentId, opt.value)}
                              type="button"
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
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
              className="inline-flex items-center gap-2 rounded-2xl bg-teal-600 px-5 py-2.5 text-xs font-black text-white shadow-md hover:bg-teal-700 disabled:opacity-50"
              disabled={!previewUrl || isProcessing || hasApiKey === false}
              onClick={handleAnalyze}
              type="button"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span>กำลังตรวจจับการเช็คชื่อ...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>เริ่มสแกนใบเช็คชื่อ</span>
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
              <span>ยืนยันและนำเข้าผลการเช็คชื่อ</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
