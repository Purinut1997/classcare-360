import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Eye,
  FileCheck,
  FileUp,
  Flame,
  HelpCircle,
  Image as ImageIcon,
  Layers,
  Maximize2,
  RefreshCw,
  Sliders,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  Users,
  Volume2,
  VolumeX,
  X,
  AlertTriangle,
  Zap,
  VideoOff,
} from 'lucide-react';
import type {
  AnswerSheetConfig,
  OmrRecordingMode,
  OmrStudentMode,
  ScannedAnswerDetail,
  ScannedExamResult,
} from '../../types/omr';
import {
  analyzeAnswerSheetImage,
  CHOICE_KEYS_ABCD,
  generateSyntheticFilledSheet,
  getChoiceLabel,
  omrAudio,
} from '../../lib/omrEngine';

interface StudentRosterItem {
  id: string;
  student_code: string;
  first_name: string;
  last_name: string;
  nickname?: string | null;
}

interface ClassroomItem {
  id: string;
  name: string;
  grade_level?: string;
}

interface OmrScannerProps {
  config: AnswerSheetConfig;
  classrooms?: ClassroomItem[];
  activeClassroomId?: string | null;
  onSelectClassroom?: (classroomId: string) => void;
  studentsInActiveRoom?: StudentRosterItem[];
  onCommitScoreEntry?: (studentId: string, score: number, assessmentId?: string) => Promise<void> | void;
  onEditConfig?: () => void;
  workspaceName?: string;
}

export function OmrScanner({
  config,
  classrooms = [],
  activeClassroomId,
  onSelectClassroom,
  studentsInActiveRoom = [],
  onCommitScoreEntry,
  onEditConfig,
  workspaceName = 'ClassCare 360',
}: OmrScannerProps) {
  // Mode States
  const [studentMode, setStudentMode] = useState<OmrStudentMode>('classroom');
  const [recordingMode, setRecordingMode] = useState<OmrRecordingMode>('verify_first');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Scanner UI States
  const [scanMethod, setScanMethod] = useState<'camera' | 'upload'>('camera');
  const [isCameraStarted, setIsCameraStarted] = useState(false); // User must explicitly click to turn on camera
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  // Results & Review States
  const [sessionResults, setSessionResults] = useState<ScannedExamResult[]>([]);
  const [activeReviewResult, setActiveReviewResult] = useState<ScannedExamResult | null>(null);
  const [activeDisplayHud, setActiveDisplayHud] = useState<ScannedExamResult | null>(null);
  const [selectedStudentForReview, setSelectedStudentForReview] = useState<string>('');
  const [instantSuccessBanner, setInstantSuccessBanner] = useState<string | null>(null);

  // Video & Canvas Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const autoScanTimerRef = useRef<number | null>(null);

  // 1. Initialize and Manage Camera Stream
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setIsCameraActive(true);
    } catch (err) {
      console.warn('Camera access issue:', err);
      setCameraError('ไม่สามารถเข้าถึงกล้องได้ กรุณาอนุญาตการใช้กล้องในเบราว์เซอร์ หรือใช้วิธีอัปโหลดภาพแทน');
      setIsCameraActive(false);
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    if (autoScanTimerRef.current) {
      clearInterval(autoScanTimerRef.current);
      autoScanTimerRef.current = null;
    }
  }, []);

  const toggleCameraFacing = () => {
    setFacingMode((curr) => (curr === 'environment' ? 'user' : 'environment'));
  };

  useEffect(() => {
    if (scanMethod === 'camera' && isCameraStarted) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [scanMethod, isCameraStarted, startCamera, stopCamera]);

  // 2. Score Processing Logic
  const handleScanResultObtained = useCallback(
    async (result: ScannedExamResult) => {
      if (recordingMode === 'display_only') {
        // Mode 3: Display score only, no DB save
        if (soundEnabled) omrAudio.playSuccess();
        setActiveDisplayHud(result);
        setSessionResults((prev) => [result, ...prev]);
        return;
      }

      if (recordingMode === 'instant_auto' && result.status !== 'pending_review') {
        // Mode 2: Instant Auto-Save (when confidence is high and no conflicting marks)
        if (soundEnabled) omrAudio.playSuccess();
        result.isSavedToGradebook = true;
        result.status = 'confirmed';

        if (result.studentId && onCommitScoreEntry) {
          await onCommitScoreEntry(result.studentId, result.totalScore, config.assessmentId || undefined);
        }

        setInstantSuccessBanner(
          `บันทึกคะแนนอัตโนมัติสำเร็จ: ${result.studentName} ได้ ${result.totalScore}/${result.maxScore} คะแนน (${result.percentage}%)`
        );
        setTimeout(() => setInstantSuccessBanner(null), 3000);

        setSessionResults((prev) => [result, ...prev]);
        return;
      }

      // Mode 1: Review & Verify first (Default & Recommended)
      if (soundEnabled) {
        if (result.flags.length > 0) omrAudio.playWarning();
        else omrAudio.playClick();
      }
      setSelectedStudentForReview(result.studentId || '');
      setActiveReviewResult(result);
    },
    [recordingMode, soundEnabled, config.assessmentId, onCommitScoreEntry]
  );

  // Capture current camera frame and analyze
  const captureAndScanCurrentFrame = async () => {
    if (!videoRef.current || isProcessing) return;
    setIsProcessing(true);

    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const result = await analyzeAnswerSheetImage(canvas, config, {
        studentMode,
        recordingMode,
        targetStudentList: studentsInActiveRoom,
      });

      await handleScanResultObtained(result);
    } catch (err) {
      console.error('Scan error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. Upload File / Batch Images Processing
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        await new Promise<void>((resolve, reject) => {
          img.onload = async () => {
            try {
              const res = await analyzeAnswerSheetImage(img, config, {
                studentMode,
                recordingMode,
                targetStudentList: studentsInActiveRoom,
              });
              await handleScanResultObtained(res);
              URL.revokeObjectURL(objectUrl);
              resolve();
            } catch (e) {
              reject(e);
            }
          };
          img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Failed to load image'));
          };
          img.src = objectUrl;
        });
      }
    } catch (err) {
      console.error('Error processing uploaded images:', err);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 4. Quick Simulation for Instant Testing
  const handleSimulateTestSheet = async () => {
    setIsProcessing(true);
    try {
      // Pick random student from roster or random roll
      const randomRoll = Math.floor(1 + Math.random() * (studentsInActiveRoom.length || 25));
      const simulatedCanvas = generateSyntheticFilledSheet(config, {
        rollNumber: randomRoll,
        accuracyRate: 0.8 + Math.random() * 0.15,
      });

      const result = await analyzeAnswerSheetImage(simulatedCanvas, config, {
        studentMode,
        recordingMode,
        targetStudentList: studentsInActiveRoom,
      });

      await handleScanResultObtained(result);
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // 5. Review & Confirm Submission
  const handleConfirmReview = async () => {
    if (!activeReviewResult) return;

    const updatedResult: ScannedExamResult = {
      ...activeReviewResult,
      studentId: selectedStudentForReview || activeReviewResult.studentId,
      status: 'confirmed',
      isSavedToGradebook: true,
    };

    // If student was reassigned manually
    if (selectedStudentForReview) {
      const matched = studentsInActiveRoom.find((s) => s.id === selectedStudentForReview);
      if (matched) {
        updatedResult.studentName = `${matched.first_name} ${matched.last_name} (${matched.student_code})`;
      }
    }

    if (updatedResult.studentId && onCommitScoreEntry) {
      await onCommitScoreEntry(
        updatedResult.studentId,
        updatedResult.totalScore,
        config.assessmentId || undefined
      );
    }

    if (soundEnabled) omrAudio.playSuccess();

    setSessionResults((prev) => [updatedResult, ...prev.filter((r) => r.id !== updatedResult.id)]);
    setActiveReviewResult(null);
  };

  // Modify individual question in review drawer
  const handleOverrideChoiceInReview = (questionNum: number, choiceKey: string) => {
    if (!activeReviewResult) return;

    const currentDetail = activeReviewResult.answersDetail.find((a) => a.questionNumber === questionNum);
    if (!currentDetail) return;

    const isNowCorrect = choiceKey === currentDetail.correctChoice;
    const scoreDiff = (isNowCorrect ? currentDetail.maxScore : 0) - currentDetail.scoreAwarded;

    const updatedDetails: ScannedAnswerDetail[] = activeReviewResult.answersDetail.map((item) => {
      if (item.questionNumber === questionNum) {
        return {
          ...item,
          detectedChoice: choiceKey,
          isCorrect: isNowCorrect,
          scoreAwarded: isNowCorrect ? item.maxScore : 0,
          flag: 'ok',
        };
      }
      return item;
    });

    const newScore = activeReviewResult.totalScore + scoreDiff;
    const newCorrect = updatedDetails.filter((d) => d.isCorrect).length;
    const newPercent = Math.round((newScore / activeReviewResult.maxScore) * 100);

    setActiveReviewResult({
      ...activeReviewResult,
      answersDetail: updatedDetails,
      totalScore: newScore,
      correctCount: newCorrect,
      incorrectCount: activeReviewResult.answersDetail.length - newCorrect,
      percentage: newPercent,
      detectedAnswers: {
        ...activeReviewResult.detectedAnswers,
        [questionNum]: choiceKey,
      },
    });
  };

  const choiceKeys = CHOICE_KEYS_ABCD.slice(0, config.choicesCount);

  return (
    <div className="space-y-6">
      {/* Instant Notification Banner */}
      {instantSuccessBanner && (
        <div className="flex items-center justify-between rounded-2xl bg-emerald-500 p-4 text-white shadow-lg animate-in fade-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={24} className="text-white" />
            <span className="font-bold text-sm">{instantSuccessBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setInstantSuccessBanner(null)}
            className="rounded-lg bg-emerald-600/60 p-1 hover:bg-emerald-600"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Control Console: 1. Student Mode & 2. Recording Mode */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Student Mode Selector */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Users size={14} className="text-cyan-600" />
              1. โหมดผู้สอบ (Student Mode)
            </span>
            <span className="text-[11px] font-bold text-slate-500">
              {studentMode === 'classroom' ? `${studentsInActiveRoom.length} คนในห้อง` : 'บุคคลทั่วไป'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setStudentMode('classroom')}
              className={`flex items-center gap-2 rounded-xl p-2.5 text-left transition ${
                studentMode === 'classroom'
                  ? 'border-2 border-cyan-600 bg-cyan-50/70 text-cyan-950 font-black shadow-2xs'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-bold'
              }`}
            >
              <UserCheck size={16} className={studentMode === 'classroom' ? 'text-cyan-600' : 'text-slate-400'} />
              <div className="text-xs">
                <div>นักเรียนในชั้น</div>
                <div className="text-[10px] text-slate-500 font-normal">จับคู่เลขที่/รหัสอัตโนมัติ</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setStudentMode('anonymous')}
              className={`flex items-center gap-2 rounded-xl p-2.5 text-left transition ${
                studentMode === 'anonymous'
                  ? 'border-2 border-cyan-600 bg-cyan-50/70 text-cyan-950 font-black shadow-2xs'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-bold'
              }`}
            >
              <Users size={16} className={studentMode === 'anonymous' ? 'text-cyan-600' : 'text-slate-400'} />
              <div className="text-xs">
                <div>บุคคลทั่วไป / ไม่มีชื่อ</div>
                <div className="text-[10px] text-slate-500 font-normal">ตรวจนับคะแนนอิสระ</div>
              </div>
            </button>
          </div>

          {/* Classroom Dropdown when studentMode is 'classroom' */}
          {studentMode === 'classroom' && classrooms.length > 0 && (
            <div className="pt-1">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                ห้องเรียนเป้าหมายที่ต้องการบันทึกคะแนน:
              </label>
              <select
                value={activeClassroomId || ''}
                onChange={(e) => onSelectClassroom && onSelectClassroom(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500"
              >
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.grade_level ? `(${c.grade_level})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Score Recording Workflow Mode Selector */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Sliders size={14} className="text-emerald-600" />
              2. โหมดการบันทึกคะแนน (Recording Workflow)
            </span>
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800"
              title="เปิด/ปิดเสียงตอบสนอง"
            >
              {soundEnabled ? (
                <>
                  <Volume2 size={13} className="text-emerald-600" />
                  <span>เสียงเปิด</span>
                </>
              ) : (
                <>
                  <VolumeX size={13} className="text-slate-400" />
                  <span>ปิดเสียง</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              {
                mode: 'verify_first' as OmrRecordingMode,
                icon: FileCheck,
                label: 'ตรวจสอบก่อนบันทึก',
                sub: 'ตรวจเช็คจุดที่สงสัยก่อนคลิกบันทึก (แนะนำ)',
                badge: 'ปลอดภัยสุด',
                color: 'border-emerald-600 bg-emerald-50/70 text-emerald-950',
              },
              {
                mode: 'instant_auto' as OmrRecordingMode,
                icon: Zap,
                label: 'บันทึกอัตโนมัติทันที',
                sub: 'สแกนรัวๆ บันทึกทันทีพร้อมเสียง Beep',
                badge: 'เร็วสุด',
                color: 'border-blue-600 bg-blue-50/70 text-blue-950',
              },
              {
                mode: 'display_only' as OmrRecordingMode,
                icon: Eye,
                label: 'แจ้งคะแนนเฉยๆ',
                sub: 'แสดง HUD คะแนน ไม่บันทึกลงระบบ',
                badge: 'ดูผลสด',
                color: 'border-amber-600 bg-amber-50/70 text-amber-950',
              },
            ].map((item) => {
              const isSelected = recordingMode === item.mode;
              const Icon = item.icon;
              return (
                <button
                  key={item.mode}
                  type="button"
                  onClick={() => setRecordingMode(item.mode)}
                  className={`flex flex-col text-left rounded-xl p-2.5 border transition ${
                    isSelected
                      ? `border-2 ${item.color} font-black shadow-2xs`
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-bold'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Icon size={16} />
                    <span className="text-[9.5px] font-mono rounded px-1 py-0.2 bg-white/70 border border-slate-200">
                      {item.badge}
                    </span>
                  </div>
                  <span className="text-xs mt-1.5 font-bold">{item.label}</span>
                  <span className="text-[10px] text-slate-500 font-normal mt-0.5 line-clamp-2">
                    {item.sub}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Scanner Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Live Camera View or Upload Area */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
            {/* View Switching Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setScanMethod('camera')}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition ${
                    scanMethod === 'camera'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Camera size={14} />
                  กล้องโทรศัพท์ / Webcam
                </button>
                <button
                  type="button"
                  onClick={() => setScanMethod('upload')}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition ${
                    scanMethod === 'upload'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Upload size={14} />
                  อัปโหลดไฟล์ภาพ
                </button>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSimulateTestSheet}
                  disabled={isProcessing}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-900 hover:bg-amber-100 transition shadow-2xs"
                  title="จำลองกระดาษคำตอบที่ฝนแล้วเพื่อทดสอบตรวจทันทีโดยไม่ต้องใช้กระดาษจริง"
                >
                  <Sparkles size={13} className="text-amber-600" />
                  ทดสอบด้วยตัวอย่างจำลอง
                </button>
                {onEditConfig && (
                  <button
                    type="button"
                    onClick={onEditConfig}
                    className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900"
                  >
                    <Sliders size={13} />
                    แก้ไขเฉลย
                  </button>
                )}
              </div>
            </div>

            {/* Camera Viewfinder */}
            {scanMethod === 'camera' ? (
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 flex items-center justify-center border border-slate-800">
                {!isCameraStarted ? (
                  /* Privacy-first Standby Card before turning on Camera */
                  <div className="flex flex-col items-center justify-center text-center p-8 max-w-md space-y-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="relative">
                      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-inner">
                        <Camera size={36} />
                      </div>
                      <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 border-2 border-slate-950 text-amber-400">
                        <VideoOff size={14} />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="text-base font-black text-white">กล้องยังไม่ได้เปิดใช้งาน (Camera Standby)</h4>
                      <p className="text-xs text-slate-400 leading-relaxed font-normal">
                        เพื่อความเป็นส่วนตัวของคุณครู ระบบจะไม่เปิดกล้องอัตโนมัติ
                        กรุณากดปุ่มด้านล่างเมื่อพร้อมนำกระดาษคำตอบมาวางสแกน
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => setIsCameraStarted(true)}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 text-xs font-black text-white shadow-lg hover:from-emerald-400 hover:to-teal-400 active:scale-95 transition"
                      >
                        <Camera size={16} />
                        เปิดกล้องเพื่อเริ่มสแกน (Start Camera)
                      </button>

                      <button
                        type="button"
                        onClick={() => setScanMethod('upload')}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-white transition"
                      >
                        <Upload size={14} />
                        อัปโหลดภาพแทน
                      </button>
                    </div>
                  </div>
                ) : cameraError ? (
                  <div className="p-6 text-center text-rose-300 max-w-sm">
                    <AlertTriangle className="mx-auto mb-2 text-rose-400" size={36} />
                    <p className="text-xs font-bold">{cameraError}</p>
                    <div className="mt-3 flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={startCamera}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-black text-slate-900"
                      >
                        <RefreshCw size={13} />
                        ลองใหม่อีกครั้ง
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsCameraStarted(false)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-black text-slate-300 hover:bg-slate-700"
                      >
                        ยกเลิก
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      autoPlay
                      className="h-full w-full object-cover"
                    />

                    {/* Top Status Bar with Turn Off Camera Button */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-auto">
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-950/80 px-3 py-1 backdrop-blur-xs text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                        กล้องกำลังทำงาน
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setIsCameraStarted(false);
                          stopCamera();
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/90 px-3 py-1 text-[11px] font-bold text-rose-300 backdrop-blur-xs hover:bg-rose-950 hover:text-rose-200 border border-rose-500/30 transition shadow-xs"
                        title="ปิดการใช้งานกล้อง"
                      >
                        <VideoOff size={13} />
                        ปิดกล้อง (Stop Camera)
                      </button>
                    </div>

                    {/* Aim Guide Overlay with corner brackets */}
                    <div className="pointer-events-none absolute inset-6 flex flex-col justify-between border-2 border-emerald-400/40 rounded-2xl">
                      {/* Top Corner Brackets */}
                      <div className="flex justify-between p-2">
                        <div className="h-6 w-6 border-t-4 border-l-4 border-emerald-400" />
                        <div className="h-6 w-6 border-t-4 border-r-4 border-emerald-400" />
                      </div>

                      {/* Center alignment guide text */}
                      <div className="self-center rounded-full bg-slate-950/70 backdrop-blur-xs px-4 py-1 text-center text-[11px] font-bold text-emerald-300 border border-emerald-500/30">
                        เล็งกระดาษคำตอบให้มาร์กเกอร์ 4 มุมเข้ากรอบ
                      </div>

                      {/* Bottom Corner Brackets */}
                      <div className="flex justify-between p-2">
                        <div className="h-6 w-6 border-b-4 border-l-4 border-emerald-400" />
                        <div className="h-6 w-6 border-b-4 border-r-4 border-emerald-400" />
                      </div>
                    </div>

                    {/* Camera Control Overlay Buttons */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-auto">
                      <button
                        type="button"
                        onClick={toggleCameraFacing}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900/80 text-white backdrop-blur-xs hover:bg-slate-900"
                        title="สลับกล้องหน้า/หลัง"
                      >
                        <RefreshCw size={15} />
                      </button>

                      <button
                        type="button"
                        onClick={captureAndScanCurrentFrame}
                        disabled={isProcessing}
                        className="inline-flex h-12 items-center gap-2 rounded-full bg-emerald-500 px-6 font-black text-xs text-white shadow-lg hover:bg-emerald-400 active:scale-95 transition"
                      >
                        {isProcessing ? (
                          <>
                            <RefreshCw size={15} className="animate-spin" />
                            กำลังประมวลผล...
                          </>
                        ) : (
                          <>
                            <Camera size={18} />
                            ตรวจคะแนนแผ่นนี้
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsCameraStarted(false);
                          stopCamera();
                        }}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900/80 text-rose-300 backdrop-blur-xs hover:bg-rose-950 hover:text-rose-200 transition"
                        title="ปิดกล้อง"
                      >
                        <VideoOff size={15} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              /* File Upload Zone */
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex aspect-[4/3] w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center hover:border-cyan-500 hover:bg-cyan-50/30 transition"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-2xs text-cyan-600 mb-3">
                  <FileUp size={28} />
                </div>
                <h4 className="text-sm font-black text-slate-900">
                  คลิกเพื่อเลือกไฟล์ หรือลากภาพกระดาษคำตอบมาวาง
                </h4>
                <p className="mt-1 text-xs text-slate-500 max-w-sm">
                  รองรับไฟล์ภาพ JPG, PNG, WEBP สามารถเลือกหลายรูปเพื่อตรวจพร้อมกันได้เป็นปึก
                </p>
                <button
                  type="button"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white hover:bg-slate-800"
                >
                  <Upload size={14} />
                  เลือกรูปภาพจากเครื่อง
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Session Scanned History & Score Stats */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <FileCheck size={16} className="text-cyan-600" />
                รายการที่ตรวจแล้ว ({sessionResults.length} แผ่น)
              </h3>

              {sessionResults.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSessionResults([])}
                  className="text-[11px] font-bold text-slate-400 hover:text-rose-500"
                >
                  ล้างรายการ
                </button>
              )}
            </div>

            {sessionResults.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <ImageIcon className="mx-auto text-slate-300" size={36} />
                <p className="text-xs font-bold">ยังไม่มีกระดาษคำตอบที่สแกน</p>
                <p className="text-[11px] text-slate-400">
                  กดถ่ายภาพจากกล้อง หรือกดปุ่ม "ทดสอบด้วยตัวอย่างจำลอง" เพื่อดูผลการตรวจ
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                {sessionResults.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-3 hover:bg-white hover:border-slate-300 transition"
                  >
                    <div className="space-y-0.5 min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] font-bold text-slate-500">#{idx + 1}</span>
                        <span className="text-xs font-black text-slate-900 truncate">
                          {item.studentName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500">
                        <span>ถูก {item.correctCount}</span>
                        <span>•</span>
                        <span>ผิด {item.incorrectCount}</span>
                        <span>•</span>
                        <span className="font-mono font-bold text-emerald-600">{item.percentage}%</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <span className="text-base font-black text-slate-950 font-mono">
                          {item.totalScore}
                        </span>
                        <span className="text-[10px] text-slate-500">/{item.maxScore}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStudentForReview(item.studentId || '');
                          setActiveReviewResult(item);
                        }}
                        className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-100"
                        title="ดูรายละเอียดข้อสอบ"
                      >
                        <Eye size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Review & Verification Drawer Modal (Mode 1: ตรวจสอบก่อนบันทึก) */}
      {activeReviewResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-cyan-100 px-2 py-0.5 text-[10px] font-black text-cyan-800">
                    OMR REVIEW
                  </span>
                  <h3 className="text-base font-black text-slate-900">
                    ตรวจสอบความถูกต้องของกระดาษคำตอบ
                  </h3>
                </div>
                <p className="text-xs text-slate-500">
                  ตรวจสอบคะแนนและตัวเลือก หากมีข้อที่ฝนไม่ชัดเจน สามารถคลิกแก้ไขได้ทันที
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveReviewResult(null)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Score & Student Match Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl bg-cyan-50/60 border border-cyan-100 p-4">
                <div>
                  <span className="text-[11px] font-bold text-cyan-800 block mb-1">
                    ผู้เข้าสอบ (Student Identification)
                  </span>
                  {studentMode === 'classroom' && studentsInActiveRoom.length > 0 ? (
                    <select
                      value={selectedStudentForReview}
                      onChange={(e) => setSelectedStudentForReview(e.target.value)}
                      className="w-full rounded-xl border border-cyan-200 bg-white px-3 py-1.5 text-xs font-black text-slate-800 outline-none"
                    >
                      <option value="">-- เลือกนักเรียนเพื่อจับคู่คะแนน --</option>
                      {studentsInActiveRoom.map((s, idx) => (
                        <option key={s.id} value={s.id}>
                          เลขที่ {idx + 1} : {s.first_name} {s.last_name} ({s.student_code})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-xs font-black text-slate-900">
                      {activeReviewResult.studentName}
                    </div>
                  )}
                  {activeReviewResult.studentRollNumber !== null && (
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      ตรวจจับเลขที่จากกระดาษได้: เลขที่ {activeReviewResult.studentRollNumber}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 sm:border-l sm:border-cyan-200 sm:pl-4">
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">คะแนนรวม</span>
                    <div className="text-3xl font-black text-slate-950 font-mono">
                      {activeReviewResult.totalScore}
                      <span className="text-sm font-bold text-slate-400">/{activeReviewResult.maxScore}</span>
                    </div>
                  </div>
                  <div className="rounded-xl bg-emerald-600 px-3 py-2 text-center text-white">
                    <span className="block text-lg font-black font-mono leading-none">
                      {activeReviewResult.percentage}%
                    </span>
                    <span className="text-[9px] font-bold text-emerald-100">ความแม่นยำ</span>
                  </div>
                </div>
              </div>

              {/* Flags & Warnings if any */}
              {activeReviewResult.flags.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-black text-amber-900">
                    <AlertTriangle size={14} className="text-amber-600" />
                    ข้อควรระวังจากการสแกน:
                  </div>
                  <ul className="text-[11px] text-amber-800 list-disc list-inside space-y-0.5">
                    {activeReviewResult.flags.map((flag, fIdx) => (
                      <li key={fIdx}>{flag}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Interactive Answers Grid */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                  รายละเอียดคำตอบแต่ละข้อ (คลิกวงกลมเพื่อแก้ไขหากระบบอ่านผิด)
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {activeReviewResult.answersDetail.map((ans) => {
                    const isCorrect = ans.isCorrect;
                    const isFlagged = ans.flag === 'faint' || ans.flag === 'multiple';

                    return (
                      <div
                        key={ans.questionNumber}
                        className={`flex items-center justify-between rounded-xl p-2 border transition ${
                          isCorrect
                            ? 'border-emerald-200 bg-emerald-50/40'
                            : isFlagged
                            ? 'border-amber-300 bg-amber-50/60'
                            : 'border-rose-200 bg-rose-50/40'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-black text-slate-800">
                            {ans.questionNumber}.
                          </span>
                          {isCorrect ? (
                            <span className="text-[10px] font-bold text-emerald-700">✓ ถูก</span>
                          ) : (
                            <span className="text-[10px] font-bold text-rose-600">
                              เฉลย {ans.correctChoice}
                            </span>
                          )}
                        </div>

                        {/* Choice bubbles */}
                        <div className="flex gap-1">
                          {choiceKeys.map((cKey, cIdx) => {
                            const isSelected = ans.detectedChoice === cKey;
                            const isKey = ans.correctChoice === cKey;
                            const label = getChoiceLabel(cIdx, config.choiceLabelType);

                            return (
                              <button
                                key={cKey}
                                type="button"
                                onClick={() => handleOverrideChoiceInReview(ans.questionNumber, cKey)}
                                className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black transition ${
                                  isSelected
                                    ? isKey
                                      ? 'bg-emerald-600 text-white shadow-2xs'
                                      : 'bg-rose-500 text-white shadow-2xs'
                                    : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                                }`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 bg-slate-50">
              <button
                type="button"
                onClick={() => setActiveReviewResult(null)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-100"
              >
                ยกเลิก
              </button>

              <button
                type="button"
                onClick={handleConfirmReview}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-6 py-2.5 text-xs font-black text-white hover:bg-slate-800 shadow-sm"
              >
                <Check size={14} />
                ยืนยันและบันทึกคะแนนลงระบบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mode 3 Display-Only HUD Modal (แจ้งคะแนนเฉยๆ ไม่บันทึก) */}
      {activeDisplayHud && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 mb-4">
              <CheckCircle2 size={36} />
            </div>

            <div className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700 mb-2">
              📢 โหมดแจ้งคะแนน (ไม่บันทึกลงระบบ)
            </div>

            <h3 className="text-xl font-black text-slate-950">{activeDisplayHud.studentName}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              วิชา {config.subjectName || '-'} ({config.totalQuestions} ข้อ)
            </p>

            <div className="my-6 rounded-2xl bg-slate-50 border border-slate-200 p-5">
              <div className="text-xs font-bold text-slate-500 uppercase">คะแนนที่ได้</div>
              <div className="mt-1 text-5xl font-black text-slate-900 font-mono tracking-tight">
                {activeDisplayHud.totalScore}
                <span className="text-xl font-bold text-slate-400">/{activeDisplayHud.maxScore}</span>
              </div>
              <div className="mt-2 text-sm font-black text-emerald-600">
                คิดเป็น {activeDisplayHud.percentage}% •{' '}
                {activeDisplayHud.percentage >= 50 ? 'ผ่านเกณฑ์ยอดเยี่ยม' : 'ควรพัฒนาเพิ่มเติม'}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-emerald-900">
                <span className="font-bold">ตอบถูก:</span> {activeDisplayHud.correctCount} ข้อ
              </div>
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-rose-900">
                <span className="font-bold">ตอบผิด:</span> {activeDisplayHud.incorrectCount} ข้อ
              </div>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={() => setActiveDisplayHud(null)}
                className="w-full rounded-xl bg-slate-950 py-3 text-xs font-black text-white hover:bg-slate-800 transition"
              >
                รับทราบ / ตรวจใบถัดไป
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
