import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BarChart3,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Cloud,
  FileEdit,
  FileText,
  GraduationCap,
  Layers,
  MonitorPlay,
  Sparkles,
  Sliders,
  Smartphone,
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
import { CHOICE_KEYS_ABCD, regradeScannedResults } from '../../lib/omrEngine';
import { writeAuditLog } from '../../lib/auditLog';
import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import { isDemoSession, withDemoContext } from '../../lib/auth';
import { IMAGE_WEBP_PRESETS } from '../../lib/imageOptimizer';
import type { OnlineExamMode } from '../../lib/hybridExamService';
import { EvidenceVaultSection } from '../../components/shared/EvidenceVaultSection';
import { DEMO_PRIMARY_CLASSROOMS, DEMO_PRIMARY_STUDENTS } from '../../data/p5MasterTemplate';
import { AnswerSheetDesigner } from '../../components/omr/AnswerSheetDesigner';
import { ExamAuthoringStudio } from '../../components/omr/ExamAuthoringStudio';
import { LiveQuizHostPanel } from '../../components/omr/LiveQuizHostPanel';
import { OmrScanner, type OmrAssessmentOption } from '../../components/omr/OmrScanner';
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

type OmrTabKey = 'studio' | 'designer' | 'scanner' | 'live' | 'analysis';

export function OmrAssessmentPage({ session }: OmrAssessmentPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawOmrTab = searchParams.get('omrTab');
  const currentTab: OmrTabKey =
    rawOmrTab === 'studio' ||
    rawOmrTab === 'designer' ||
    rawOmrTab === 'scanner' ||
    rawOmrTab === 'live' ||
    rawOmrTab === 'analysis'
      ? rawOmrTab
      : 'scanner';
  const urlClassroomId = searchParams.get('classroomId') || '';
  const urlSubjectName = searchParams.get('subjectName') || '';
  const urlAssessmentId = searchParams.get('assessmentId') || '';
  const appliedDeepLinkRef = useRef<string>('');
  const [designerSubTab, setDesignerSubTab] = useState<'settings' | 'answer_key' | 'preview'>('settings');
  const [livePreferredMode, setLivePreferredMode] = useState<OnlineExamMode>('mobile_exam');

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
    setToastMessage(`สลับไปใช้ชุดข้อสอบ "${template.title}" (${template.totalQuestions} ข้อ) เรียบร้อยแล้ว`);
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

  // Session Results & History (persisted per workspace + exam ID)
  const [sessionResults, setSessionResults] = useState<ScannedExamResult[]>([]);
  const [assessments, setAssessments] = useState<OmrAssessmentOption[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(
    () => config.assessmentId || null
  );
  const [isBatchSyncing, setIsBatchSyncing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const resultsStorageKey = useMemo(
    () => `classcare_omr_results:${session?.workspace?.id || 'demo'}:${config.id || 'draft'}`,
    [session?.workspace?.id, config.id]
  );

  // Hydrate persisted scan history whenever active exam changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(resultsStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setSessionResults(parsed);
          return;
        }
      }
    } catch {
      // ignore storage read error
    }
    setSessionResults([]);
  }, [resultsStorageKey]);

  // Persist scan history safely (fallback stripping large base64 images if quota hits limit)
  useEffect(() => {
    try {
      localStorage.setItem(resultsStorageKey, JSON.stringify(sessionResults));
    } catch {
      try {
        const compacted = sessionResults.map((item, idx) =>
          idx < 8
            ? item
            : { ...item, previewImageUrl: undefined, annotatedOverlayUrl: undefined }
        );
        localStorage.setItem(resultsStorageKey, JSON.stringify(compacted));
      } catch {
        // ignore quota errors
      }
    }
  }, [resultsStorageKey, sessionResults]);

  const setOmrTab = (tab: OmrTabKey) => {
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
            const matchedRoomId =
              urlClassroomId && clsData.some((c) => c.id === urlClassroomId)
                ? urlClassroomId
                : clsData[0].id;
            setSelectedClassroomId(matchedRoomId);

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
        const demoRoomId =
          urlClassroomId && DEMO_PRIMARY_CLASSROOMS.some((c) => c.id === urlClassroomId)
            ? urlClassroomId
            : DEMO_PRIMARY_CLASSROOMS[1].id; // ป.5
        setSelectedClassroomId(demoRoomId);
        setStudents(DEMO_PRIMARY_STUDENTS);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [session, urlClassroomId]);

  // Apply deep-linked classroom/subject/assessment context passed from Score Center once per signature
  useEffect(() => {
    const deepLinkKey = `${urlClassroomId}|${urlSubjectName}|${urlAssessmentId}`;
    if (!urlClassroomId && !urlSubjectName && !urlAssessmentId) return;
    if (appliedDeepLinkRef.current === deepLinkKey) return;
    if (urlClassroomId && classrooms.length === 0) return;

    appliedDeepLinkRef.current = deepLinkKey;

    const matchedRoom = classrooms.find((c) => c.id === urlClassroomId);
    if (matchedRoom) {
      setSelectedClassroomId(matchedRoom.id);
    }

    setConfig((prev) => ({
      ...prev,
      ...(urlSubjectName ? { subjectName: urlSubjectName } : {}),
      ...(urlAssessmentId ? { assessmentId: urlAssessmentId } : {}),
      ...(matchedRoom ? { classroomId: matchedRoom.id, roomName: matchedRoom.name } : {}),
    }));

    if (urlAssessmentId) {
      setSelectedAssessmentId(urlAssessmentId);
    }
  }, [classrooms, urlAssessmentId, urlClassroomId, urlSubjectName]);

  // Fetch Gradebook Score Assessments for selected classroom (workspace_id filtered)
  useEffect(() => {
    let isMounted = true;

    async function loadAssessments() {
      if (!selectedClassroomId) {
        setAssessments([]);
        return;
      }

      if (session?.workspace?.id && isSupabaseReady && supabase && !isDemoSession(session)) {
        try {
          const { data, error } = await supabase
            .from('score_assessments')
            .select('id, title, subject_name, max_score, category')
            .eq('workspace_id', session.workspace.id)
            .eq('classroom_id', selectedClassroomId)
            .order('assessment_date', { ascending: false })
            .limit(40);

          if (isMounted && !error && Array.isArray(data)) {
            const normalized = data.map((row) => ({
              id: row.id,
              title: row.title,
              subject_name: row.subject_name,
              max_score: Number(row.max_score || 0),
              category: row.category || undefined,
            }));
            setAssessments(normalized);
            if (config.assessmentId && normalized.some((a) => a.id === config.assessmentId)) {
              setSelectedAssessmentId(config.assessmentId);
            }
            return;
          }
        } catch {
          // ignore
        }
      }

      if (isMounted && (!session?.workspace?.id || isDemoSession(session))) {
        const demoAssessments: OmrAssessmentOption[] = [
          {
            id: `demo_assess_${selectedClassroomId}_mid`,
            title: config.title || 'สอบกลางภาค OMR',
            subject_name: config.subjectName || 'วิชาทั่วไป',
            max_score: config.totalScore || 20,
            category: 'exam',
          },
        ];
        setAssessments(demoAssessments);
        setSelectedAssessmentId((prev) => prev || demoAssessments[0].id);
      }
    }

    loadAssessments();
    return () => {
      isMounted = false;
    };
  }, [session, selectedClassroomId, config.assessmentId, config.title, config.subjectName, config.totalScore]);

  const activeStudents = useMemo(() => {
    if (!selectedClassroomId) return students;
    return students.filter((s) => s.classroom_id === selectedClassroomId);
  }, [students, selectedClassroomId]);

  const activeClassroomName = useMemo(
    () => classrooms.find((c) => c.id === selectedClassroomId)?.name || undefined,
    [classrooms, selectedClassroomId]
  );

  const handleSelectAssessment = (assessmentId: string | null) => {
    setSelectedAssessmentId(assessmentId);
    setConfig((prev) => ({
      ...prev,
      assessmentId,
    }));
  };

  const handleCreateAssessmentFromExam = async (params: {
    title: string;
    subjectName: string;
    maxScore: number;
  }): Promise<string | null> => {
    if (!selectedClassroomId) {
      setToastMessage('กรุณาเลือกห้องเรียนเป้าหมายก่อนสร้างช่องคะแนน');
      setTimeout(() => setToastMessage(null), 3500);
      return null;
    }

    if (!session?.workspace?.id || !isSupabaseReady || !supabase || isDemoSession(session)) {
      const demoId = `demo_omr_assess_${Date.now()}`;
      const newOpt: OmrAssessmentOption = {
        id: demoId,
        title: params.title,
        subject_name: params.subjectName,
        max_score: params.maxScore,
        category: 'exam',
      };
      setAssessments((prev) => [newOpt, ...prev]);
      handleSelectAssessment(demoId);
      setToastMessage(`สร้างช่องคะแนนใหม่ "${params.title}" สำเร็จ (โหมดทดลอง)`);
      setTimeout(() => setToastMessage(null), 3500);
      return demoId;
    }

    try {
      const { data, error } = await supabase
        .from('score_assessments')
        .insert({
          workspace_id: session.workspace.id,
          classroom_id: selectedClassroomId,
          title: params.title,
          subject_name: params.subjectName,
          category: 'exam',
          max_score: Math.max(1, params.maxScore),
          weight: Math.max(1, params.maxScore),
          assessment_date: config.examDate || new Date().toISOString().slice(0, 10),
          status: 'published',
          created_by: session.profile?.id || null,
          metadata: {
            source: 'omr_scanner',
            omr_exam_id: config.id,
          },
        })
        .select('id, title, subject_name, max_score, category')
        .single();

      if (error || !data) {
        setToastMessage(`สร้างช่องคะแนนไม่สำเร็จ: ${error?.message || 'Unknown error'}`);
        setTimeout(() => setToastMessage(null), 4000);
        return null;
      }

      const newOpt: OmrAssessmentOption = {
        id: data.id,
        title: data.title,
        subject_name: data.subject_name,
        max_score: Number(data.max_score || params.maxScore),
        category: data.category || 'exam',
      };
      setAssessments((prev) => [newOpt, ...prev]);
      handleSelectAssessment(data.id);
      setToastMessage(`สร้างและเชื่อมช่องคะแนน "${data.title}" เรียบร้อยแล้ว`);
      setTimeout(() => setToastMessage(null), 3500);
      return data.id;
    } catch (err) {
      console.warn('Failed to create assessment:', err);
      setToastMessage('เกิดข้อผิดพลาดในการสร้างช่องคะแนน');
      setTimeout(() => setToastMessage(null), 3500);
      return null;
    }
  };

  // Handle Commit Score Entry to Gradebook
  const handleCommitScoreEntry = async (
    studentId: string,
    score: number,
    assessmentId?: string
  ): Promise<boolean> => {
    const student = students.find((s) => s.id === studentId);
    const studentName = student ? `${student.first_name} ${student.last_name}` : studentId;
    const effectiveAssessmentId = assessmentId || selectedAssessmentId || config.assessmentId || null;

    if (!session || !session.workspace?.id || isDemoSession(session) || !isSupabaseReady || !supabase) {
      setToastMessage(
        `บันทึกคะแนน ${studentName} (${score}/${config.totalScore} คะแนน) เรียบร้อยแล้ว`
      );
      setTimeout(() => setToastMessage(null), 3500);
      return true;
    }

    if (!effectiveAssessmentId) {
      setToastMessage(
        `ตรวจคะแนน ${studentName} (${score}/${config.totalScore}) แล้ว • กรุณาเลือกหรือสร้างช่องคะแนน ปพ.5 เพื่อส่งขึ้นระบบ`
      );
      setTimeout(() => setToastMessage(null), 4000);
      return false;
    }

    try {
      const { error } = await supabase
        .from('score_entries')
        .upsert(
          {
            workspace_id: session.workspace.id,
            assessment_id: effectiveAssessmentId,
            student_id: studentId,
            score,
            note: 'ตรวจอัตโนมัติด้วย OMR Scanner',
            graded_by: session.profile?.id || null,
          },
          { onConflict: 'assessment_id,student_id' }
        );

      if (error) {
        console.warn('Supabase save score error:', error);
        setToastMessage(`ส่งคะแนน ${studentName} ไม่สำเร็จ: ${error.message}`);
        setTimeout(() => setToastMessage(null), 4000);
        return false;
      }

      await writeAuditLog(session, {
        action: 'score_entries.saved',
        entityId: effectiveAssessmentId,
        entityTable: 'score_entries',
        metadata: {
          score,
          source: 'omr_scanner',
          student_id: studentId,
        },
        riskLevel: 'low',
        source: 'omr_scanner',
      });

      setToastMessage(
        `บันทึกคะแนน ${studentName} (${score}/${config.totalScore} คะแนน) ลงสมุดคะแนนเรียบร้อย`
      );
      setTimeout(() => setToastMessage(null), 3500);
      return true;
    } catch (err) {
      console.warn('Supabase save score error:', err);
      setToastMessage(`เกิดข้อผิดพลาดระหว่างส่งคะแนนของ ${studentName}`);
      setTimeout(() => setToastMessage(null), 3500);
      return false;
    }
  };

  const handleBatchSyncToGradebook = async () => {
    const effectiveAssessmentId = selectedAssessmentId || config.assessmentId || null;
    if (!effectiveAssessmentId) {
      setToastMessage('กรุณาเลือกหรือสร้างช่องคะแนน ปพ.5 ก่อนกดส่งคะแนนทั้งหมด');
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }

    // Deduplicate latest result per studentId
    const latestByStudent = new Map<string, ScannedExamResult>();
    sessionResults.forEach((r) => {
      if (r.studentId && !latestByStudent.has(r.studentId)) {
        latestByStudent.set(r.studentId, r);
      }
    });
    const matchedEntries = Array.from(latestByStudent.values());
    if (matchedEntries.length === 0) {
      setToastMessage('ยังไม่มีรายการที่จับคู่ชื่อนักเรียนสำหรับส่งลงสมุดคะแนน');
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }

    setIsBatchSyncing(true);
    try {
      if (session?.workspace?.id && isSupabaseReady && supabase && !isDemoSession(session)) {
        const rows = matchedEntries.map((r) => ({
          workspace_id: session.workspace!.id,
          assessment_id: effectiveAssessmentId,
          student_id: r.studentId!,
          score: r.totalScore,
          note: 'ตรวจด้วย AI OMR Batch Sync',
          graded_by: session.profile?.id || null,
        }));

        const { error } = await supabase
          .from('score_entries')
          .upsert(rows, { onConflict: 'assessment_id,student_id' });

        if (error) {
          setToastMessage(`ส่งคะแนนไม่สำเร็จ: ${error.message}`);
          setTimeout(() => setToastMessage(null), 4000);
          return;
        }

        await writeAuditLog(session, {
          action: 'score_entries.batch_saved',
          entityId: effectiveAssessmentId,
          entityTable: 'score_entries',
          metadata: {
            count: rows.length,
            source: 'omr_scanner_batch',
          },
          riskLevel: 'low',
          source: 'omr_scanner',
        });
      }

      const syncedIds = new Set(matchedEntries.map((m) => m.studentId));
      setSessionResults((prev) =>
        prev.map((item) =>
          item.studentId && syncedIds.has(item.studentId)
            ? {
                ...item,
                status: 'confirmed',
                isSavedToGradebook: true,
                savedAssessmentId: effectiveAssessmentId,
              }
            : item
        )
      );

      setToastMessage(`ส่งคะแนนนักเรียน ${matchedEntries.length} คนลงสมุดคะแนนเรียบร้อยแล้ว`);
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setIsBatchSyncing(false);
    }
  };

  const handleBatchSaveDirectScores = async (
    entries: Array<{ studentId: string; score: number; note: string }>,
    assessmentId: string,
  ): Promise<boolean> => {
    if (!assessmentId || entries.length === 0) return false;
    if (!session?.workspace?.id || !isSupabaseReady || !supabase || isDemoSession(session)) {
      setToastMessage(`บันทึกคะแนนออนไลน์ ${entries.length} คนเรียบร้อย (โหมดตัวอย่าง)`);
      setTimeout(() => setToastMessage(null), 3500);
      return true;
    }

    const rows = entries.map((entry) => ({
      workspace_id: session.workspace!.id,
      assessment_id: assessmentId,
      student_id: entry.studentId,
      score: entry.score,
      note: entry.note,
      graded_by: session.profile?.id || null,
    }));

    const { error } = await supabase
      .from('score_entries')
      .upsert(rows, { onConflict: 'assessment_id,student_id' });

    if (error) {
      setToastMessage(`บันทึกคะแนนไม่สำเร็จ: ${error.message}`);
      setTimeout(() => setToastMessage(null), 4000);
      return false;
    }

    await writeAuditLog(session, {
      action: 'score_entries.batch_saved',
      entityId: assessmentId,
      entityTable: 'score_entries',
      metadata: {
        count: rows.length,
        source: 'hybrid_online_exam',
      },
      riskLevel: 'low',
      source: 'omr_scanner',
    });

    setToastMessage(`นำคะแนนนักเรียน ${rows.length} คนลงสมุดคะแนนเรียบร้อยแล้ว!`);
    setTimeout(() => setToastMessage(null), 4000);
    return true;
  };

  const handleRegradeAll = () => {
    setSessionResults((prev) => regradeScannedResults(prev, config));
    setToastMessage(`ตรวจคำนวณคะแนนซ้ำให้กระดาษคำตอบทั้งหมดเรียบร้อยแล้ว`);
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
    setToastMessage(`ปรับเป็นแม่แบบ "${preset.label}" เรียบร้อย พร้อมสั่งพิมพ์ได้ทันที!`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="print:hidden omr-no-print fixed top-4 right-4 z-50 flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-xs font-bold text-white shadow-xl animate-in slide-in-from-top-2">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="print:hidden omr-no-print relative overflow-hidden rounded-3xl border border-[#DCE3D7] bg-gradient-to-r from-[#1C342B] via-[#213D32] to-[#152821] p-6 sm:p-8 text-white shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-lg bg-[#2F7D5B]/30 px-3 py-1 text-xs font-black text-[#CBE4D4] border border-[#2F7D5B]/50">
              <Sparkles size={13} aria-hidden="true" />
              ระบบตรวจกระดาษคำตอบ AI Vision OMR
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              สร้าง ออกแบบ และตรวจกระดาษคำตอบผ่านกล้อง
            </h1>
            <p className="text-xs sm:text-sm font-medium text-emerald-100/80 leading-relaxed">
              สแกนด้วยกล้องมือถือหรืออัปโหลดภาพ ตรวจนับคะแนนอัตโนมัติแบบเรียลไทม์
              เลือกระบุชื่อนักเรียนในห้องเพื่อลงสมุดคะแนนทันที หรือตรวจแบบบุคคลทั่วไป พร้อมวิเคราะห์ความยากง่ายรายข้อ
            </p>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2">
            <button
              type="button"
              onClick={handleOpenMobileHandoff}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-3.5 py-2.5 text-xs font-black text-white border border-white/25 hover:bg-white/20 transition shadow-sm active:scale-95"
              title="สร้าง QR Code เพื่อส่องด้วยกล้องมือถือแล้วเปิดหน้านี้บนมือถือได้ทันที"
            >
              <Smartphone size={16} className="text-emerald-200" aria-hidden="true" />
              <span>ตรวจบนมือถือ (QR Handoff)</span>
            </button>

            <a
              href={withDemoContext('/app/dashboard?view=scores', window.location.search)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#152821] px-3.5 py-2.5 text-xs font-black text-emerald-100 border border-white/15 hover:bg-[#1C342B] hover:text-white transition shadow-sm active:scale-95"
            >
              <GraduationCap size={16} className="text-emerald-200" aria-hidden="true" />
              <span>กลับสู่ระบบคะแนน</span>
            </a>

            <button
              type="button"
              onClick={() => {
                setDesignerSubTab('preview');
                setOmrTab('designer');
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#D98B26] px-4 py-2.5 text-xs font-black text-white border border-[#E69E3D] shadow-md hover:bg-[#C27A1E] transition active:scale-95"
              title="ไปที่หน้าดูตัวอย่างกระดาษคำตอบและสั่งพิมพ์ A4 ทันที"
            >
              <Printer size={16} aria-hidden="true" />
              <span>สั่งพิมพ์ A4 ด่วน</span>
            </button>
          </div>
        </div>

        {/* Decorative Botanical Glow */}
        <div
          className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#2F7D5B]/20 blur-3xl pointer-events-none"
          aria-hidden="true"
        />
      </div>

      {/* Main Tabs Navigation (5-Step Hybrid Exam Workflow: Studio -> Paper OMR -> Scan -> Mobile/Live -> Analysis) */}
      <div className="print:hidden omr-no-print rounded-3xl border border-[#DCE3D7] bg-white p-2.5 shadow-2xs sm:p-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {[
            {
              key: 'studio' as OmrTabKey,
              step: '1',
              label: 'เขียนข้อสอบ',
              sub: 'ปรนัย/ตอบสั้น/AI',
              icon: FileEdit,
            },
            {
              key: 'designer' as OmrTabKey,
              step: '2',
              label: 'กระดาษ OMR',
              sub: 'ออกแบบ & พิมพ์ A4',
              icon: FileText,
            },
            {
              key: 'scanner' as OmrTabKey,
              step: '3',
              label: 'ตรวจกระดาษ OMR',
              sub: 'สแกนกล้อง & AI',
              icon: Camera,
            },
            {
              key: 'live' as OmrTabKey,
              step: '4',
              label: 'สอบมือถือ & ควิซสด',
              sub: 'PIN 6 หลัก / QR',
              icon: MonitorPlay,
            },
            {
              key: 'analysis' as OmrTabKey,
              step: '5',
              label: 'วิเคราะห์ผล',
              sub: 'ความยากง่ายรายข้อ',
              icon: BarChart3,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setOmrTab(tab.key)}
                className={`flex items-center gap-2.5 rounded-2xl border p-3 text-left transition ${
                  isActive
                    ? 'border-[#1C342B] bg-[#1C342B] text-white shadow-sm'
                    : 'border-[#E5E8E1] bg-[#FAFBF9] text-[#1F2924] hover:border-[#BFE0CD] hover:bg-[#E6F4EC]/50'
                }`}
              >
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-black ${
                    isActive ? 'bg-[#2F7D5B] text-white' : 'bg-white border border-[#DCE3D7] text-[#1C573D]'
                  }`}
                >
                  <Icon size={17} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-extrabold">
                    {tab.step}. {tab.label}
                  </span>
                  <span
                    className={`block truncate text-[10px] font-semibold ${
                      isActive ? 'text-emerald-100/80' : 'text-[#75827a]'
                    }`}
                  >
                    {tab.sub}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab 0: Authoring Studio ("เขียนครั้งเดียว ใช้ได้ 3 ทาง") */}
      {currentTab === 'studio' && (
        <ExamAuthoringStudio
          config={config}
          onChangeConfig={(nextCfg) => setConfig(nextCfg)}
          onPrintOmr={() => {
            setDesignerSubTab('preview');
            setOmrTab('designer');
          }}
          onLaunchMobileExam={() => {
            setLivePreferredMode('mobile_exam');
            setOmrTab('live');
          }}
          onLaunchLiveQuiz={() => {
            setLivePreferredMode('live_quiz');
            setOmrTab('live');
          }}
          session={session}
        />
      )}

      {/* Tab 4: Mobile Exam & Live Quiz Host */}
      {currentTab === 'live' && (
        <LiveQuizHostPanel
          config={config}
          session={session}
          classrooms={classrooms}
          activeClassroomId={selectedClassroomId}
          onSelectClassroom={(id) => setSelectedClassroomId(id)}
          studentsInActiveRoom={activeStudents}
          assessments={assessments}
          selectedAssessmentId={selectedAssessmentId}
          onSelectAssessment={handleSelectAssessment}
          onCreateAssessment={handleCreateAssessmentFromExam}
          onBatchSaveScores={handleBatchSaveDirectScores}
          preferredMode={livePreferredMode}
          onGoToStudio={() => setOmrTab('studio')}
        />
      )}

      {/* Tab 1: Scanner */}
      {currentTab === 'scanner' && (
        <OmrScanner
          config={config}
          session={session}
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
          sessionResults={sessionResults}
          onResultsChange={setSessionResults}
          assessments={assessments}
          selectedAssessmentId={selectedAssessmentId}
          onSelectAssessment={handleSelectAssessment}
          onCreateAssessment={handleCreateAssessmentFromExam}
          onBatchSyncToGradebook={handleBatchSyncToGradebook}
          isBatchSyncing={isBatchSyncing}
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
          studentsInActiveRoom={activeStudents}
          activeClassroomName={activeClassroomName}
          scannedResultsCount={sessionResults.length}
          onRegradeScanned={handleRegradeAll}
        />
      )}

      {/* Tab 3: Item Analysis */}
      {currentTab === 'analysis' && (
        <OmrItemAnalysis config={config} results={sessionResults} />
      )}

      {session ? (
        <div className="mt-5">
          <EvidenceVaultSection
            compact
            entityId={selectedAssessmentId || config.id || null}
            moduleKey="omr_score_scan"
            optimizePreset={IMAGE_WEBP_PRESETS.document_scan}
            session={session}
            subtitle="บันทึกภาพกระดาษคำตอบ OMR หรือใบคะแนนที่ตรวจแล้ว (แปลง .webp เก็บลง Google Drive ไว้ยืนยันผลย้อนหลัง)"
            title="คลังหลักฐานกระดาษคำตอบ OMR และใบคะแนน AI"
          />
        </div>
      ) : null}

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
                <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#5A6F64]">
                  <Cloud size={12} className="text-[#2F7D5B] shrink-0" aria-hidden="true" />
                  ข้อมูลชุดข้อสอบถูกซิงค์กับระบบคลาวด์แล้ว สามารถเปิดบนอุปกรณ์ใดก็ได้
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
