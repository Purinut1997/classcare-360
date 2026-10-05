import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BarChart3,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  FileText,
  GraduationCap,
  Layers,
  Sparkles,
  Sliders,
  Users,
  Printer,
  QrCode,
  RefreshCw,
  FolderArchive,
  X,
  Copy,
  Check as CheckIcon,
} from 'lucide-react';
import QRCode from 'qrcode';
import type { AppSessionContext } from '../../types/core';
import type { AnswerSheetConfig, AnswerSheetLayout, ChoiceLabelType, ExamBankTemplate, ScannedExamResult } from '../../types/omr';
import { CHOICE_KEYS_ABCD } from '../../lib/omrEngine';
import { writeAuditLog } from '../../lib/auditLog';
import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import { isDemoSession, withDemoContext } from '../../lib/auth';
import { DEMO_PRIMARY_CLASSROOMS, DEMO_PRIMARY_STUDENTS } from '../../data/p5MasterTemplate';
import { AnswerSheetDesigner } from '../../components/omr/AnswerSheetDesigner';
import { OmrScanner } from '../../components/omr/OmrScanner';
import { OmrItemAnalysis } from '../../components/omr/OmrItemAnalysis';
import {
  getExamBankTemplates,
  fetchCloudExamTemplates,
  fetchCloudActiveDraft,
  saveCloudActiveDraft,
} from '../../lib/omrExamBankStorage';

const STORAGE_DRAFT_KEY = 'classcare_omr_active_draft';

interface OmrAssessmentPageProps {
  session: AppSessionContext | null;
}

export function OmrAssessmentPage({ session }: OmrAssessmentPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get('omrTab') as 'scanner' | 'designer' | 'analysis') || 'scanner';
  const [designerSubTab, setDesignerSubTab] = useState<'settings' | 'answer_key' | 'preview'>('settings');

  // Classroom & Students Data
  const [classrooms, setClassrooms] = useState<Array<{ id: string; name: string; grade_level?: string }>>([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>('');
  const [students, setStudents] = useState<
    Array<{ id: string; student_code: string; first_name: string; last_name: string; classroom_id?: string | null }>
  >([]);

  // Default Initial Exam Configuration with LocalStorage Persistence
  const [config, setConfig] = useState<AnswerSheetConfig>(() => {
    try {
      const savedDraft = localStorage.getItem(STORAGE_DRAFT_KEY);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed && typeof parsed.totalQuestions === 'number' && parsed.answerKeys) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse cached omr draft:', e);
    }

    const totalQ = 20;
    const defaultKeys: Record<number, string> = {
      1: 'A', 2: 'B', 3: 'C', 4: 'A', 5: 'D',
      6: 'B', 7: 'C', 8: 'A', 9: 'D', 10: 'C',
      11: 'A', 12: 'B', 13: 'D', 14: 'C', 15: 'A',
      16: 'B', 17: 'C', 18: 'D', 19: 'A', 20: 'B',
    };
    const defaultPoints: Record<number, number> = {};
    for (let i = 1; i <= totalQ; i++) defaultPoints[i] = 1;

    return {
      id: `omr-exam-${Date.now()}`,
      title: 'กระดาษคำตอบมาตรฐาน (Standard Answer Sheet)',
      subjectName: 'วิทยาศาสตร์และเทคโนโลยี',
      schoolName: 'โรงเรียน ClassCare 360',
      isUniversalRoom: true,
      roomName: '',
      examDate: new Date().toISOString().slice(0, 10),
      instructions: 'ใช้ดินสอดำ 2B ฝนในวงกลมตัวเลือกที่ถูกต้องที่สุดเพียงข้อเดียว',
      totalQuestions: totalQ,
      choicesCount: 4,
      choiceLabelType: 'THAI',
      layout: 'eco_half',
      studentIdFormat: 'roll_number',
      themeColor: 'slate',
      answerKeys: defaultKeys,
      pointsPerQuestion: defaultPoints,
      classroomId: null,
      assessmentId: null,
      totalScore: totalQ,
      teacherId: session?.profile?.id || 'teacher_demo_01',
      teacherName: session?.profile?.displayName || 'ครูผู้สอน',
    };
  });

  // Automatically save any answer key or config updates to localStorage & Cloud
  useEffect(() => {
    try {
      if (config) {
        localStorage.setItem(STORAGE_DRAFT_KEY, JSON.stringify(config));
      }
    } catch (e) {
      console.warn('Failed to save omr draft to localStorage:', e);
    }

    if (session?.profile?.id && isSupabaseReady) {
      const timer = setTimeout(() => {
        saveCloudActiveDraft(config, session).catch(() => {});
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [config, session]);

  // Exam Bank & Cloud Sync State
  const [bankTemplates, setBankTemplates] = useState<ExamBankTemplate[]>(() => getExamBankTemplates());
  const [isCloudSynced, setIsCloudSynced] = useState(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);

  // Mobile Handoff QR Modal State
  const [showMobileHandoffModal, setShowMobileHandoffModal] = useState(false);
  const [mobileHandoffQrUrl, setMobileHandoffQrUrl] = useState<string>('');
  const [hasCopiedMobileLink, setHasCopiedMobileLink] = useState(false);

  // Select an exam from cloud bank to use as active exam
  const handleSelectTemplate = (template: ExamBankTemplate) => {
    const loadedConfig: AnswerSheetConfig = {
      ...config,
      id: template.id,
      title: template.title,
      subjectName: template.subjectName,
      schoolName: template.schoolName || config.schoolName,
      teacherId: template.teacherId || session?.profile?.id,
      teacherName: template.teacherName || session?.profile?.displayName,
      academicYear: template.academicYear,
      term: template.term,
      isUniversalRoom: template.isUniversalRoom !== false,
      roomName: template.roomName || '',
      totalQuestions: template.totalQuestions,
      choicesCount: template.choicesCount,
      choiceLabelType: template.choiceLabelType,
      layout: template.layout,
      studentIdFormat: template.studentIdFormat,
      totalScore: template.totalScore,
      themeColor: template.themeColor || 'slate',
      examSet: template.examSet || '01',
      examSets: template.examSets || { [template.examSet || '01']: template.answerKeys },
      answerKeys: template.answerKeys,
      pointsPerQuestion: template.pointsPerQuestion,
    };
    setConfig(loadedConfig);
    setToastMessage(`⚡ สลับไปใช้ชุดข้อสอบ "${template.title}" (${template.totalQuestions} ข้อ) เรียบร้อยแล้ว`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Sync exams from cloud on load & listen to query param loadExam/examId
  const refreshCloudExams = async () => {
    if (!session?.workspace?.id && !session?.profile?.id) return;
    setIsSyncingCloud(true);
    try {
      const [cloudList, cloudDraft] = await Promise.all([
        fetchCloudExamTemplates(session?.workspace?.id, session?.profile?.id),
        fetchCloudActiveDraft(session),
      ]);

      if (cloudList && cloudList.length > 0) {
        setBankTemplates(cloudList);
      }

      // Check if URL specifies an exam to load
      const targetExamId = searchParams.get('examId') || searchParams.get('loadExam');
      if (targetExamId) {
        const found = cloudList?.find((t) => t.id === targetExamId);
        if (found) {
          handleSelectTemplate(found);
          setIsCloudSynced(true);
          return;
        }
      }

      // If mobile first open and no local draft or empty draft, use cloud draft from computer
      const localRaw = localStorage.getItem(STORAGE_DRAFT_KEY);
      if (!localRaw && cloudDraft && cloudDraft.answerKeys && Object.keys(cloudDraft.answerKeys).length > 0) {
        setConfig(cloudDraft);
      }

      setIsCloudSynced(true);
    } catch (err) {
      console.warn('OMR cloud sync warning:', err);
    } finally {
      setIsSyncingCloud(false);
    }
  };

  useEffect(() => {
    refreshCloudExams();
  }, [session?.workspace?.id, session?.profile?.id]);

  // Generate Mobile Handoff QR Code
  const handleOpenMobileHandoff = async () => {
    setShowMobileHandoffModal(true);
    setHasCopiedMobileLink(false);
    try {
      const origin = window.location.origin;
      const targetUrl = `${origin}/app/dashboard?view=omr-scanner&examId=${encodeURIComponent(config.id)}&omrTab=scanner`;
      const qrData = await QRCode.toDataURL(targetUrl, {
        margin: 2,
        width: 320,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });
      setMobileHandoffQrUrl(qrData);
    } catch (e) {
      console.error('Failed to generate handoff QR:', e);
    }
  };

  // Session Results & History
  const [sessionResults, setSessionResults] = useState<ScannedExamResult[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const setOmrTab = (tab: 'scanner' | 'designer' | 'analysis') => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set('omrTab', tab);
      return p;
    });
  };

  // Load Classrooms and Students
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (session?.workspace?.id && isSupabaseReady && supabase) {
        try {
          const { data: clsData } = await supabase
            .from('classrooms')
            .select('id, name, grade_level')
            .eq('workspace_id', session.workspace.id)
            .order('name');

          if (isMounted && clsData && clsData.length > 0) {
            setClassrooms(clsData);
            setSelectedClassroomId(clsData[0].id);

            const { data: stuData } = await supabase
              .from('students')
              .select('id, student_code, first_name, last_name, classroom_id')
              .eq('workspace_id', session.workspace.id)
              .order('student_code');

            if (isMounted && stuData) {
              setStudents(stuData);
            }
            return;
          }
        } catch {
          // Fallback to demo
        }
      }

      // Demo fallback only in demo session or when no workspace is selected
      if (isMounted && (!session?.workspace?.id || isDemoSession(session))) {
        setClassrooms(DEMO_PRIMARY_CLASSROOMS);
        setSelectedClassroomId(DEMO_PRIMARY_CLASSROOMS[1].id); // ป.5
        setStudents(DEMO_PRIMARY_STUDENTS);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [session]);

  const activeStudents = useMemo(() => {
    if (!selectedClassroomId) return students;
    return students.filter((s) => s.classroom_id === selectedClassroomId);
  }, [students, selectedClassroomId]);

  // Handle Commit Score Entry to Gradebook
  const handleCommitScoreEntry = async (studentId: string, score: number, assessmentId?: string) => {
    const student = students.find((s) => s.id === studentId);
    const studentName = student ? `${student.first_name} ${student.last_name}` : studentId;

    if (session && isSupabaseReady && supabase && assessmentId && session.workspace?.id) {
      try {
        await supabase
          .from('score_entries')
          .upsert(
            {
              workspace_id: session.workspace.id,
              assessment_id: assessmentId,
              student_id: studentId,
              score,
              note: 'ตรวจอัตโนมัติด้วย OMR Scanner',
            },
            { onConflict: 'assessment_id,student_id' }
          );

        await writeAuditLog(session, {
          action: 'score_entries.saved',
          entityId: assessmentId,
          entityTable: 'score_entries',
          metadata: {
            score,
            source: 'omr_scanner',
            student_id: studentId,
          },
          riskLevel: 'low',
          source: 'omr_scanner',
        });
      } catch (err) {
        console.warn('Supabase save score error:', err);
      }
    }

    setToastMessage(`บันทึกคะแนน ${studentName} (${score}/${config.totalScore} คะแนน) เรียบร้อยแล้ว`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // ⚡ Handle 1-Click Express Print Preset
  const handleSelectQuickPreset = (preset: {
    totalQuestions: number;
    layout: AnswerSheetLayout;
    choicesCount: 3 | 4 | 5;
    choiceLabelType: ChoiceLabelType;
    label: string;
  }) => {
    const choices = CHOICE_KEYS_ABCD.slice(0, preset.choicesCount);
    const newKeys: Record<number, string> = {};
    const newPoints: Record<number, number> = {};
    for (let q = 1; q <= preset.totalQuestions; q++) {
      newKeys[q] = config.answerKeys[q] || choices[(q - 1) % choices.length];
      newPoints[q] = config.pointsPerQuestion[q] || 1;
    }

    const currentSet = config.examSet || '01';
    const nextExamSets = { ...(config.examSets || {}) };
    nextExamSets[currentSet] = newKeys;

    setConfig((prev) => ({
      ...prev,
      totalQuestions: preset.totalQuestions,
      layout: preset.layout,
      choicesCount: preset.choicesCount,
      choiceLabelType: preset.choiceLabelType,
      answerKeys: newKeys,
      pointsPerQuestion: newPoints,
      examSets: nextExamSets,
      totalScore: preset.totalQuestions,
    }));

    setDesignerSubTab('preview');
    setOmrTab('designer');
    setToastMessage(`⚡ ปรับเป็นแม่แบบ "${preset.label}" เรียบร้อย พร้อมสั่งพิมพ์ได้ทันที!`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-xs font-bold text-white shadow-xl animate-in slide-in-from-top-2">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950 p-6 sm:p-8 text-white shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-lg bg-cyan-500/20 px-3 py-1 text-xs font-black text-cyan-300 border border-cyan-400/30">
              <Sparkles size={13} />
              ระบบตรวจกระดาษคำตอบ AI Vision OMR
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              สร้าง ออกแบบ และตรวจกระดาษคำตอบผ่านกล้อง
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-300 leading-relaxed">
              สแกนด้วยกล้องมือถือหรืออัปโหลดภาพ ตรวจนับคะแนนอัตโนมัติแบบเรียลไทม์
              เลือกระบุชื่อนักเรียนในห้องเพื่อลงสมุดคะแนนทันที หรือตรวจแบบบุคคลทั่วไป พร้อมวิเคราะห์ความยากง่ายรายข้อ
            </p>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2">
            <button
              type="button"
              onClick={handleOpenMobileHandoff}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-500/20 px-3.5 py-2.5 text-xs font-black text-indigo-100 border-2 border-indigo-400/50 hover:bg-indigo-500/35 transition shadow-sm active:scale-95"
              title="สร้าง QR Code เพื่อส่องด้วยกล้องมือถือแล้วเปิดหน้านี้บนมือถือได้ทันที"
            >
              <QrCode size={16} className="text-indigo-300" />
              <span>📱 ตรวจบนมือถือ (QR Handoff)</span>
            </button>

            <a
              href={withDemoContext('/app/dashboard?view=scores', window.location.search)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800/80 px-3.5 py-2.5 text-xs font-black text-slate-200 border-2 border-slate-700 hover:bg-slate-800 hover:border-slate-500 hover:text-white transition shadow-sm active:scale-95"
            >
              <GraduationCap size={16} className="text-slate-400" />
              <span>กลับสู่ระบบคะแนน</span>
            </a>

            <button
              type="button"
              onClick={() => {
                setDesignerSubTab('preview');
                setOmrTab('designer');
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-2.5 text-xs font-black text-slate-950 border-2 border-amber-300 shadow-md hover:from-amber-300 hover:to-amber-400 transition active:scale-95"
              title="ไปที่หน้าดูตัวอย่างกระดาษคำตอบและสั่งพิมพ์ A4 ทันที"
            >
              <Printer size={16} />
              <span>🖨️ สั่งพิมพ์ A4 ด่วน</span>
            </button>
          </div>
        </div>

        {/* Decorative Grid Pattern */}
        <div
          className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none"
          aria-hidden="true"
        />
      </div>

      {/* Main Tabs Navigation (3-Step Hero Stepper Bar) */}
      <div className="rounded-3xl border-2 border-slate-200/90 bg-white p-3 sm:p-4 shadow-sm">
        <div className="mb-2.5 flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
              ขั้นตอนการทำงาน OMR (กดเลือกสลับเมนูได้ทันที):
            </span>
          </div>
          <span className="hidden sm:inline-flex text-[11px] font-bold text-slate-400">
            ระบบบันทึกและซิงค์ข้อมูลอัตโนมัติ
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {/* Tab 1: Scanner */}
          <button
            type="button"
            onClick={() => setOmrTab('scanner')}
            className={`group relative flex items-center gap-3.5 rounded-2xl p-3.5 text-left transition-all duration-150 ${
              currentTab === 'scanner'
                ? 'border-2 border-cyan-500 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950 text-white shadow-md ring-2 ring-cyan-500/20'
                : 'border-2 border-slate-200/90 bg-white text-slate-800 shadow-2xs hover:border-cyan-400 hover:bg-cyan-50/30 hover:shadow-sm active:scale-[0.99]'
            }`}
          >
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-black text-sm transition ${
                currentTab === 'scanner'
                  ? 'bg-cyan-500 text-slate-950 shadow-xs'
                  : 'border border-slate-200 bg-slate-100 text-slate-700 group-hover:bg-cyan-100 group-hover:text-cyan-800 group-hover:border-cyan-300'
              }`}
            >
              <Camera size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] font-black uppercase tracking-wider rounded-md px-1.5 py-0.5 ${
                  currentTab === 'scanner' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30' : 'bg-slate-100 text-slate-600'
                }`}>
                  ขั้นตอนที่ 1
                </span>
                {currentTab === 'scanner' && (
                  <span className="text-[10px] font-black text-emerald-400 flex items-center gap-1">
                    ● เปิดใช้งาน
                  </span>
                )}
              </div>
              <p className="truncate text-xs sm:text-sm font-black mt-0.5">
                สแกน & ตรวจข้อสอบ (OMR)
              </p>
              <p className={`text-[11px] font-medium truncate ${currentTab === 'scanner' ? 'text-slate-300' : 'text-slate-500'}`}>
                ใช้กล้องมือถือ/เว็บแคม ตรวจคะแนนทันที
              </p>
            </div>
            <ChevronRight
              size={18}
              className={`shrink-0 transition-transform ${
                currentTab === 'scanner' ? 'text-cyan-400 translate-x-0.5' : 'text-slate-300 group-hover:text-slate-600 group-hover:translate-x-0.5'
              }`}
            />
          </button>

          {/* Tab 2: Designer & Answer Keys */}
          <button
            type="button"
            onClick={() => setOmrTab('designer')}
            className={`group relative flex items-center gap-3.5 rounded-2xl p-3.5 text-left transition-all duration-150 ${
              currentTab === 'designer'
                ? 'border-2 border-cyan-500 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950 text-white shadow-md ring-2 ring-cyan-500/20'
                : 'border-2 border-slate-200/90 bg-white text-slate-800 shadow-2xs hover:border-cyan-400 hover:bg-cyan-50/30 hover:shadow-sm active:scale-[0.99]'
            }`}
          >
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-black text-sm transition ${
                currentTab === 'designer'
                  ? 'bg-cyan-500 text-slate-950 shadow-xs'
                  : 'border border-slate-200 bg-slate-100 text-slate-700 group-hover:bg-cyan-100 group-hover:text-cyan-800 group-hover:border-cyan-300'
              }`}
            >
              <FileText size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] font-black uppercase tracking-wider rounded-md px-1.5 py-0.5 ${
                  currentTab === 'designer' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30' : 'bg-slate-100 text-slate-600'
                }`}>
                  ขั้นตอนที่ 2
                </span>
                {currentTab === 'designer' && (
                  <span className="text-[10px] font-black text-emerald-400 flex items-center gap-1">
                    ● เปิดใช้งาน
                  </span>
                )}
              </div>
              <p className="truncate text-xs sm:text-sm font-black mt-0.5">
                ออกแบบกระดาษ & กำหนดเฉลย
              </p>
              <p className={`text-[11px] font-medium truncate ${currentTab === 'designer' ? 'text-slate-300' : 'text-slate-500'}`}>
                สร้างกระดาษ A4, เฉลย ก ข ค ง, พิมพ์ข้อสอบ
              </p>
            </div>
            <ChevronRight
              size={18}
              className={`shrink-0 transition-transform ${
                currentTab === 'designer' ? 'text-cyan-400 translate-x-0.5' : 'text-slate-300 group-hover:text-slate-600 group-hover:translate-x-0.5'
              }`}
            />
          </button>

          {/* Tab 3: Analysis */}
          <button
            type="button"
            onClick={() => setOmrTab('analysis')}
            className={`group relative flex items-center gap-3.5 rounded-2xl p-3.5 text-left transition-all duration-150 ${
              currentTab === 'analysis'
                ? 'border-2 border-cyan-500 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950 text-white shadow-md ring-2 ring-cyan-500/20'
                : 'border-2 border-slate-200/90 bg-white text-slate-800 shadow-2xs hover:border-cyan-400 hover:bg-cyan-50/30 hover:shadow-sm active:scale-[0.99]'
            }`}
          >
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-black text-sm transition ${
                currentTab === 'analysis'
                  ? 'bg-cyan-500 text-slate-950 shadow-xs'
                  : 'border border-slate-200 bg-slate-100 text-slate-700 group-hover:bg-cyan-100 group-hover:text-cyan-800 group-hover:border-cyan-300'
              }`}
            >
              <BarChart3 size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] font-black uppercase tracking-wider rounded-md px-1.5 py-0.5 ${
                  currentTab === 'analysis' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30' : 'bg-slate-100 text-slate-600'
                }`}>
                  ขั้นตอนที่ 3
                </span>
                {sessionResults.length > 0 && (
                  <span className="rounded-md bg-cyan-100 px-1.5 py-0.5 text-[10px] font-bold text-cyan-800">
                    {sessionResults.length} แผ่น
                  </span>
                )}
              </div>
              <p className="truncate text-xs sm:text-sm font-black mt-0.5">
                ผลคะแนน & วิเคราะห์รายข้อ
              </p>
              <p className={`text-[11px] font-medium truncate ${currentTab === 'analysis' ? 'text-slate-300' : 'text-slate-500'}`}>
                สถิติความยากง่าย อำนาจจำแนก ตัดเกรด
              </p>
            </div>
            <ChevronRight
              size={18}
              className={`shrink-0 transition-transform ${
                currentTab === 'analysis' ? 'text-cyan-400 translate-x-0.5' : 'text-slate-300 group-hover:text-slate-600 group-hover:translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Tab 1: Scanner */}
      {currentTab === 'scanner' && (
        <OmrScanner
          config={config}
          classrooms={classrooms}
          activeClassroomId={selectedClassroomId}
          onSelectClassroom={(id) => setSelectedClassroomId(id)}
          studentsInActiveRoom={activeStudents}
          onCommitScoreEntry={handleCommitScoreEntry}
          onEditConfig={() => {
            setDesignerSubTab('answer_key');
            setOmrTab('designer');
          }}
          workspaceName={config.schoolName || (session?.workspace?.name && session.workspace.name !== 'ป.5' ? session.workspace.name : 'โรงเรียน ClassCare 360')}
          savedTemplates={bankTemplates}
          onSelectExamTemplate={handleSelectTemplate}
          isCloudSynced={isCloudSynced}
          isSyncingCloud={isSyncingCloud}
          onRefreshCloud={refreshCloudExams}
          onOpenMobileHandoffQr={handleOpenMobileHandoff}
        />
      )}

      {/* Tab 2: Designer */}
      {currentTab === 'designer' && (
        <AnswerSheetDesigner
          config={config}
          onChangeConfig={(newCfg) => setConfig(newCfg)}
          onStartScanning={() => setOmrTab('scanner')}
          workspaceName={config.schoolName || (session?.workspace?.name && session.workspace.name !== 'ป.5' ? session.workspace.name : 'โรงเรียน ClassCare 360')}
          teacherId={session?.profile?.id}
          teacherName={session?.profile?.displayName}
          workspaceId={session?.workspace?.id}
          initialSubTab={designerSubTab}
        />
      )}

      {/* Tab 3: Item Analysis */}
      {currentTab === 'analysis' && (
        <OmrItemAnalysis config={config} results={sessionResults} />
      )}

      {/* Modal: Mobile Scanner Handoff QR Code */}
      {showMobileHandoffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-3xl bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-2xs">
                  <QrCode size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    เปิดตรวจบนมือถือ (QR Handoff)
                  </h3>
                  <p className="text-xs font-medium text-slate-500">
                    ยิง QR เพื่อเปิดชุดข้อสอบนี้บนมือถือได้ทันที
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileHandoffModal(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 text-center space-y-4">
              <div className="rounded-2xl bg-indigo-50/60 border border-indigo-100 p-3">
                <p className="text-xs font-black text-indigo-950">
                  {config.title}
                </p>
                <p className="text-[11px] font-bold text-indigo-700 mt-0.5">
                  วิชา: {config.subjectName} • จำนวน {config.totalQuestions} ข้อ • ชุดที่ {config.examSet || '01'}
                </p>
              </div>

              <div className="flex justify-center p-3 rounded-2xl border-2 border-dashed border-indigo-200 bg-slate-50">
                {mobileHandoffQrUrl ? (
                  <img
                    src={mobileHandoffQrUrl}
                    alt="Mobile Scanner QR"
                    className="h-56 w-56 rounded-xl object-contain shadow-2xs"
                  />
                ) : (
                  <div className="flex h-56 w-56 items-center justify-center">
                    <RefreshCw className="animate-spin text-indigo-600" size={32} />
                  </div>
                )}
              </div>

              <div className="text-left bg-slate-50 rounded-2xl p-3 border border-slate-100 space-y-1.5">
                <p className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-cyan-600 text-[10px] text-white">1</span>
                  เปิดกล้องโทรศัพท์มือถือ ส่องที่ QR Code ด้านบน
                </p>
                <p className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-cyan-600 text-[10px] text-white">2</span>
                  กดเปิดลิงก์ ระบบจะพาเข้าสู่หน้าตรวจ OMR พร้อมเฉลยชุดนี้ทันที
                </p>
                <p className="text-[11px] font-medium text-slate-500">
                  ☁️ ข้อมูลชุดข้อสอบถูกซิงค์กับระบบคลาวด์แล้ว สามารถเปิดบนอุปกรณ์ใดก็ได้
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const targetUrl = `${window.location.origin}/app/dashboard?view=omr-scanner&examId=${encodeURIComponent(config.id)}&omrTab=scanner`;
                    navigator.clipboard.writeText(targetUrl);
                    setHasCopiedMobileLink(true);
                    setTimeout(() => setHasCopiedMobileLink(false), 2500);
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-black text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                >
                  {hasCopiedMobileLink ? <CheckIcon size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  {hasCopiedMobileLink ? 'คัดลอกลิงก์แล้ว!' : 'คัดลอกลิงก์สำหรับเปิดบนมือถือ'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowMobileHandoffModal(false)}
                  className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white hover:bg-slate-800 transition shadow-2xs"
                >
                  ปิด
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
