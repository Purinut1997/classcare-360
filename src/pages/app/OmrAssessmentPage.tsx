import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BarChart3,
  Camera,
  CheckCircle2,
  ChevronRight,
  FileText,
  GraduationCap,
  Layers,
  Sparkles,
  Sliders,
  Users,
} from 'lucide-react';
import type { AppSessionContext } from '../../types/core';
import type { AnswerSheetConfig, ScannedExamResult } from '../../types/omr';
import { writeAuditLog } from '../../lib/auditLog';
import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import { withDemoContext } from '../../lib/auth';
import { DEMO_PRIMARY_CLASSROOMS, DEMO_PRIMARY_STUDENTS } from '../../data/p5MasterTemplate';
import { AnswerSheetDesigner } from '../../components/omr/AnswerSheetDesigner';
import { OmrScanner } from '../../components/omr/OmrScanner';
import { OmrItemAnalysis } from '../../components/omr/OmrItemAnalysis';

interface OmrAssessmentPageProps {
  session: AppSessionContext | null;
}

export function OmrAssessmentPage({ session }: OmrAssessmentPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get('omrTab') as 'scanner' | 'designer' | 'analysis') || 'scanner';

  // Classroom & Students Data
  const [classrooms, setClassrooms] = useState<Array<{ id: string; name: string; grade_level?: string }>>([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>('');
  const [students, setStudents] = useState<
    Array<{ id: string; student_code: string; first_name: string; last_name: string; classroom_id?: string | null }>
  >([]);

  // Default Initial Exam Configuration
  const [config, setConfig] = useState<AnswerSheetConfig>(() => {
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

      // Demo fallback
      if (isMounted) {
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

    if (session && isSupabaseReady && supabase && assessmentId) {
      try {
        await supabase
          .from('score_entries')
          .upsert(
            {
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

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <a
              href={withDemoContext('/app/dashboard?view=scores', window.location.search)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-xs border border-white/20 hover:bg-white/20 transition"
            >
              <GraduationCap size={15} />
              กลับไปที่ระบบคะแนน
            </a>
            <button
              type="button"
              onClick={() => setOmrTab('designer')}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-5 py-2.5 text-xs font-black text-slate-950 shadow-md hover:bg-cyan-400 transition"
            >
              <FileText size={15} />
              ออกแบบกระดาษใหม่
              <ChevronRight size={13} />
            </button>
          </div>
        </div>

        {/* Decorative Grid Pattern */}
        <div
          className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none"
          aria-hidden="true"
        />
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setOmrTab('scanner')}
            className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-black transition ${
              currentTab === 'scanner'
                ? 'bg-slate-950 text-white shadow-sm ring-1 ring-slate-900'
                : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
            }`}
          >
            <Camera size={15} className={currentTab === 'scanner' ? 'text-cyan-400' : 'text-slate-400'} />
            1. สแกนและตรวจข้อสอบ (OMR Scanner)
          </button>

          <button
            type="button"
            onClick={() => setOmrTab('designer')}
            className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-black transition ${
              currentTab === 'designer'
                ? 'bg-slate-950 text-white shadow-sm ring-1 ring-slate-900'
                : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
            }`}
          >
            <FileText size={15} className={currentTab === 'designer' ? 'text-cyan-400' : 'text-slate-400'} />
            2. ออกแบบกระดาษคำตอบ & เฉลย
          </button>

          <button
            type="button"
            onClick={() => setOmrTab('analysis')}
            className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-black transition ${
              currentTab === 'analysis'
                ? 'bg-slate-950 text-white shadow-sm ring-1 ring-slate-900'
                : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
            }`}
          >
            <BarChart3 size={15} className={currentTab === 'analysis' ? 'text-cyan-400' : 'text-slate-400'} />
            3. ผลคะแนน & วิเคราะห์รายข้อ (Item Analysis)
            {sessionResults.length > 0 && (
              <span className="rounded-md bg-cyan-100 px-1.5 py-0.5 text-[10px] font-bold text-cyan-800">
                {sessionResults.length}
              </span>
            )}
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
          onEditConfig={() => setOmrTab('designer')}
          workspaceName={config.schoolName || (session?.workspace?.name && session.workspace.name !== 'ป.5' ? session.workspace.name : 'โรงเรียน ClassCare 360')}
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
        />
      )}

      {/* Tab 3: Item Analysis */}
      {currentTab === 'analysis' && (
        <OmrItemAnalysis config={config} results={sessionResults} />
      )}
    </div>
  );
}
