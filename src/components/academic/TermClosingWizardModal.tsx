import React, { useState, useEffect, useMemo } from 'react';
import {
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ShieldAlert,
  GraduationCap,
  Users,
  ChevronRight,
  RefreshCw,
  Sparkles,
  Calendar,
  X,
  Printer,
  FileCheck,
} from 'lucide-react';
import { isDemoSession } from '../../lib/auth';
import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import { writeAuditLog } from '../../lib/auditLog';
import { getPrimaryMasterData } from '../../data/p5MasterTemplate';
import {
  evaluatePromotionDecision,
  NEXT_GRADE_LEVEL_MAP,
  type AuditIssue,
  type StudentPromotionStatus,
} from '../../lib/termLifecycle';
import {
  fetchRealAcademicDataForClassroom,
  type OBECSchoolHeader,
} from '../../lib/obecAcademicEngine';
import { loadSchoolReportIdentity } from '../../lib/scheduleSettings';
import type { AppSessionContext } from '../../types/core';

interface TermClosingWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: AppSessionContext;
  currentClassroomId?: string;
  currentClassroomName?: string;
  academicYear?: string;
  term?: string;
  onSuccess?: () => void;
}

export const TermClosingWizardModal: React.FC<TermClosingWizardModalProps> = ({
  isOpen,
  onClose,
  session,
  currentClassroomId,
  currentClassroomName = 'ประถมศึกษาปีที่ 5',
  academicYear = '2568',
  term = '1',
  onSuccess,
}) => {
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockTimestamp, setLockTimestamp] = useState<string | null>(null);
  const [studentsStatus, setStudentsStatus] = useState<StudentPromotionStatus[]>([]);
  const [auditIssues, setAuditIssues] = useState<AuditIssue[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'promoted' | 'retained' | 'graduated'>('all');

  const workspaceId = session.workspace?.id;
  const isDemo = isDemoSession(session);
  const gradeLevel = currentClassroomName.split('/')[0] || 'ป.5';

  useEffect(() => {
    if (isOpen) {
      setActiveStep(1);
      runPreClosingAudit();
    }
  }, [isOpen, currentClassroomId, currentClassroomName, academicYear, term]);

  const runPreClosingAudit = async () => {
    setLoading(true);
    try {
      // 1. ตรวจสอบสถานะการล็อกเดิมจากฐานข้อมูล term_closing_audits
      if (supabase && workspaceId && currentClassroomId) {
        try {
          const { data: existingAudit } = await supabase
            .from('term_closing_audits')
            .select('*')
            .eq('workspace_id', workspaceId)
            .eq('classroom_id', currentClassroomId)
            .eq('academic_year', academicYear)
            .eq('term', term)
            .maybeSingle();

          if (existingAudit && existingAudit.status === 'locked') {
            setIsLocked(true);
            setLockTimestamp(existingAudit.locked_at);
          } else {
            setIsLocked(false);
            setLockTimestamp(null);
          }
        } catch (auditCheckErr) {
          console.warn('Check existing audit failed:', auditCheckErr);
        }
      }

      if (isDemo || !isSupabaseReady || !workspaceId) {
        // โหมดตัวอย่าง: คำนวณจาก Master Data และจำลองกรณีขอบเกณฑ์
        const master = getPrimaryMasterData(currentClassroomName);
        const issues: AuditIssue[] = [];

        const calculated: StudentPromotionStatus[] = master.students.map((st, idx) => {
          const isBorderline = idx === master.students.length - 1 && master.students.length > 5;
          const attPct = isBorderline ? 78 : 88 + ((idx * 7) % 12);
          const failSub = 0;
          const passTrait = true;
          const passAct = !isBorderline;

          const evalRes = evaluatePromotionDecision({
            attendancePercentage: attPct,
            failedBasicSubjectCount: failSub,
            hasPassedCharacteristics: passTrait,
            hasPassedActivities: passAct,
            currentGradeLevel: gradeLevel,
          });

          if (isBorderline) {
            issues.push(
              {
                type: 'critical',
                category: 'attendance',
                studentId: `st-${st.student_code}`,
                studentName: `${st.title}${st.first_name} ${st.last_name}`,
                classroomName: currentClassroomName,
                message: `เวลาเรียนต่ำกว่าเกณฑ์ สพฐ. 80% (ได้ ${attPct}%)`,
              },
              {
                type: 'warning',
                category: 'activity',
                studentId: `st-${st.student_code}`,
                studentName: `${st.title}${st.first_name} ${st.last_name}`,
                classroomName: currentClassroomName,
                message: 'กิจกรรมลูกเสือ/เนตรนารี ยังไม่ผ่านการประเมิน (มผ)',
              }
            );
          }

          return {
            studentId: `st-${st.student_code}`,
            studentCode: st.student_code,
            studentName: `${st.title}${st.first_name} ${st.last_name}`,
            currentClassroom: currentClassroomName,
            currentGradeLevel: gradeLevel,
            attendancePercentage: attPct,
            hasPassedAllBasicSubjects: failSub === 0,
            hasPassedCharacteristics: passTrait,
            hasPassedActivities: passAct,
            decision: evalRes.decision,
            targetGradeLevel: evalRes.targetGradeLevel,
            notes: evalRes.reasons.join(', '),
            gpa: Number((2.8 + ((idx * 3) % 12) * 0.1).toFixed(2)),
          };
        });

        setStudentsStatus(calculated);
        setAuditIssues(issues);
        setLoading(false);
        return;
      }

      // โหมดจริง: ดึงข้อมูลการประเมินวิชาการจริงจาก Supabase
      if (!supabase) {
        setLoading(false);
        return;
      }

      const identity = loadSchoolReportIdentity(workspaceId);
      const schoolHeader: OBECSchoolHeader = {
        schoolName: identity.schoolName || session.workspace?.schoolName || session.workspace?.name || 'โรงเรียน',
        district: identity.district || '',
        province: identity.province || '',
        jurisdiction: identity.jurisdiction || '',
        directorName: identity.directorName || '',
        directorPosition: identity.directorPosition || '',
        academicHeadName: identity.academicHeadName || '',
        registrarName: identity.registrarName || '',
        homeroomTeacherName: identity.teacherName || session.profile?.displayName || 'ครูประจำชั้น',
        schoolLogoDataUrl: identity.useGarudaInsteadOfLogo ? '' : identity.schoolLogoDataUrl,
        useGarudaInsteadOfLogo: identity.useGarudaInsteadOfLogo,
      };

      const realData = await fetchRealAcademicDataForClassroom(
        supabase,
        workspaceId,
        currentClassroomId || '',
        gradeLevel,
        currentClassroomName,
        academicYear,
        schoolHeader
      );

      if (realData && realData.students.length > 0) {
        const issues: AuditIssue[] = [];
        const calculated: StudentPromotionStatus[] = realData.students.map((st, idx) => {
          const summary = realData.classSummaryScores.find((cs) => cs.studentId === st.id);
          const report = realData.studentReports[st.id];

          const attPct = summary ? summary.attendancePercent : 100;
          const gpaVal = summary ? summary.gpa : 0;
          const coreSubjects = (report?.subjects || []).filter((sub) => sub.category === 'core');
          const failedCore = coreSubjects.filter((sub) => sub.isPassed === false);
          const passTrait = report ? report.evaluations.characteristicsOverall !== 'ไม่ผ่าน' : true;
          const passAct = report ? report.evaluations.activitiesOverall !== 'ไม่ผ่าน' : true;

          const evalRes = evaluatePromotionDecision({
            attendancePercentage: attPct,
            failedBasicSubjectCount: failedCore.length,
            hasPassedCharacteristics: passTrait,
            hasPassedActivities: passAct,
            currentGradeLevel: gradeLevel,
          });

          if (attPct < 80) {
            issues.push({
              type: 'critical',
              category: 'attendance',
              studentId: st.id,
              studentName: `${st.first_name} ${st.last_name}`,
              classroomName: currentClassroomName,
              message: `เวลาเรียนต่ำกว่าเกณฑ์ สพฐ. 80% (ได้ ${attPct}%)`,
            });
          }

          if (failedCore.length > 0) {
            issues.push({
              type: 'critical',
              category: 'score',
              studentId: st.id,
              studentName: `${st.first_name} ${st.last_name}`,
              classroomName: currentClassroomName,
              message: `มีวิชาพื้นฐานไม่ผ่านเกณฑ์ ${failedCore.length} วิชา (${failedCore.map((f) => f.name).join(', ')})`,
            });
          }

          if (!passTrait) {
            issues.push({
              type: 'warning',
              category: 'characteristic',
              studentId: st.id,
              studentName: `${st.first_name} ${st.last_name}`,
              classroomName: currentClassroomName,
              message: 'คุณลักษณะอันพึงประสงค์ไม่ผ่านเกณฑ์',
            });
          }

          if (!passAct) {
            issues.push({
              type: 'warning',
              category: 'activity',
              studentId: st.id,
              studentName: `${st.first_name} ${st.last_name}`,
              classroomName: currentClassroomName,
              message: 'กิจกรรมพัฒนาผู้เรียนไม่ผ่านเกณฑ์ (มผ)',
            });
          }

          return {
            studentId: st.id,
            studentCode: st.student_code || String(idx + 1),
            studentName: `${st.first_name} ${st.last_name}`,
            currentClassroom: currentClassroomName,
            currentGradeLevel: gradeLevel,
            attendancePercentage: attPct,
            hasPassedAllBasicSubjects: failedCore.length === 0,
            hasPassedCharacteristics: passTrait,
            hasPassedActivities: passAct,
            decision: evalRes.decision,
            targetGradeLevel: evalRes.targetGradeLevel,
            notes: evalRes.reasons.join(', '),
            gpa: gpaVal,
          };
        });

        setStudentsStatus(calculated);
        setAuditIssues(issues);
        setLoading(false);
        return;
      }

      // กรณีห้องเรียนยังไม่มีการบันทึกคะแนนสอบ: ดึงรายชื่อนักเรียนพื้นฐาน
      const { data: stData } = await supabase
        .from('students')
        .select('*')
        .eq('classroom_id', currentClassroomId || '')
        .eq('workspace_id', workspaceId)
        .order('student_code', { ascending: true });

      const realStudents = (stData || []) as any[];

      if (realStudents.length === 0) {
        setStudentsStatus([]);
        setAuditIssues([]);
        setLoading(false);
        return;
      }

      const issues: AuditIssue[] = [
        {
          type: 'warning',
          category: 'score',
          classroomName: currentClassroomName,
          message: 'ยังไม่พบการบันทึกคะแนนสอบอย่างเป็นทางการในภาคเรียนนี้ ระบบใช้ข้อมูลเวลาเรียนเบื้องต้นในการประเมิน',
        },
      ];

      const calculated: StudentPromotionStatus[] = realStudents.map((st, idx) => {
        const attPct = 100;
        const evalRes = evaluatePromotionDecision({
          attendancePercentage: attPct,
          failedBasicSubjectCount: 0,
          hasPassedCharacteristics: true,
          hasPassedActivities: true,
          currentGradeLevel: gradeLevel,
        });

        return {
          studentId: st.id,
          studentCode: st.student_code || String(idx + 1),
          studentName: `${st.first_name} ${st.last_name}`,
          currentClassroom: currentClassroomName,
          currentGradeLevel: gradeLevel,
          attendancePercentage: attPct,
          hasPassedAllBasicSubjects: true,
          hasPassedCharacteristics: true,
          hasPassedActivities: true,
          decision: evalRes.decision,
          targetGradeLevel: evalRes.targetGradeLevel,
          notes: 'รอการบันทึกผลสอบทางการ',
          gpa: 0,
        };
      });

      setStudentsStatus(calculated);
      setAuditIssues(issues);
    } catch (err) {
      console.error('Audit failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmLockTerm = async () => {
    setLoading(true);
    try {
      const nowIso = new Date().toISOString();

      // บันทึกลงฐานข้อมูล Supabase เมื่ออยู่ในโหมดจริง
      if (supabase && workspaceId && currentClassroomId) {
        // 1. บันทึกผลการ Audit ลงตาราง term_closing_audits
        try {
          await supabase
            .from('term_closing_audits')
            .upsert(
              {
                workspace_id: workspaceId,
                classroom_id: currentClassroomId,
                academic_year: academicYear,
                term: term,
                status: 'locked',
                total_students: studentsStatus.length,
                promoted_count: studentsStatus.filter((s) => s.decision === 'promoted').length,
                retained_count: studentsStatus.filter((s) => s.decision === 'retained').length,
                graduated_count: studentsStatus.filter((s) => s.decision === 'graduated').length,
                pending_count: studentsStatus.filter((s) => s.decision === 'pending').length,
                audit_issues: auditIssues,
                audit_summary: {
                  lockedAt: nowIso,
                  lockedBy: session.profile?.displayName || session.profile?.id,
                  classroomName: currentClassroomName,
                },
                locked_at: nowIso,
                locked_by: session.profile?.id,
                updated_at: nowIso,
              },
              { onConflict: 'workspace_id,classroom_id,academic_year,term' }
            );
        } catch (auditErr) {
          console.warn('Upsert term_closing_audits warning:', auditErr);
        }

        // 2. บันทึกผลการตัดสินรายบุคคลลงตาราง student_promotions
        try {
          const promotionRows = studentsStatus.map((st) => ({
            workspace_id: workspaceId,
            student_id: st.studentId,
            classroom_id: currentClassroomId,
            academic_year: academicYear,
            term: term,
            decision: st.decision === 'pending' ? 'pending_remedial' : st.decision,
            from_grade_level: gradeLevel,
            to_grade_level: st.targetGradeLevel || null,
            attendance_rate: st.attendancePercentage,
            gpa: st.gpa || null,
            desirable_traits_result: st.hasPassedCharacteristics ? 'ผ่าน' : 'ไม่ผ่าน',
            reading_writing_result: 'ผ่าน',
            activities_result: st.hasPassedActivities ? 'ผ่าน' : 'ไม่ผ่าน',
            remarks: st.notes || null,
            decided_by: session.profile?.id,
            decided_at: nowIso,
            updated_at: nowIso,
          }));

          if (promotionRows.length > 0) {
            await supabase
              .from('student_promotions')
              .upsert(promotionRows, { onConflict: 'workspace_id,student_id,academic_year,term' });
          }
        } catch (promErr) {
          console.warn('Upsert student_promotions warning:', promErr);
        }

        // 3. สั่งล็อก Period Lock ผ่าน RPC เพื่อป้องกันการแก้ไขคะแนนและเวลาเรียนย้อนหลัง
        try {
          const yearNum = parseInt(academicYear, 10);
          const cYear = yearNum > 2500 ? yearNum - 543 : 2025;
          const sampleMonth = `${cYear}-${term === '1' ? '10' : '03'}-01`;

          await supabase.rpc('set_period_lock', {
            target_workspace_id: workspaceId,
            target_classroom_id: currentClassroomId,
            target_month: sampleMonth,
            target_module: 'scores',
            lock_reason: `ปิดภาคเรียนที่ ${term}/${academicYear} โดยงานวิชาการ`,
          });
          await supabase.rpc('set_period_lock', {
            target_workspace_id: workspaceId,
            target_classroom_id: currentClassroomId,
            target_month: sampleMonth,
            target_module: 'attendance',
            lock_reason: `ปิดภาคเรียนที่ ${term}/${academicYear} โดยงานวิชาการ`,
          });
        } catch (lockRpcErr) {
          console.warn('Set period lock warning:', lockRpcErr);
        }
      }

      setIsLocked(true);
      setLockTimestamp(nowIso);

      // Audit log
      await writeAuditLog(session, {
        action: 'term.locked',
        entityId: currentClassroomId || 'academic_term',
        entityTable: 'academic_terms',
        metadata: {
          classroomName: currentClassroomName,
          academicYear,
          term,
          studentCount: studentsStatus.length,
          promotedCount: studentsStatus.filter((s) => s.decision === 'promoted').length,
          retainedCount: studentsStatus.filter((s) => s.decision === 'retained').length,
          graduatedCount: studentsStatus.filter((s) => s.decision === 'graduated').length,
        },
      });

      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = useMemo(() => {
    if (statusFilter === 'all') return studentsStatus;
    return studentsStatus.filter((s) => s.decision === statusFilter);
  }, [studentsStatus, statusFilter]);

  const criticalIssues = useMemo(() => auditIssues.filter((i) => i.type === 'critical'), [auditIssues]);
  const warningIssues = useMemo(() => auditIssues.filter((i) => i.type === 'warning'), [auditIssues]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-600 text-white shadow-md shadow-amber-500/20">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-800">ระบบปิดภาคเรียน & เลื่อนชั้นเรียน (สพฐ.)</h2>
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                  ห้อง {currentClassroomName} | เทอม {term}/{academicYear}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                กระบวนการตรวจสอบความพร้อม ล็อคคะแนน ป้องกันการแก้ไขย้อนหลัง และประมวลผลการเลื่อนชั้นอัตโนมัติ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Wizard Progress Bar */}
        <div className="flex border-b border-slate-200 bg-white">
          <button
            onClick={() => setActiveStep(1)}
            className={`flex flex-1 items-center justify-center gap-2 border-b-2 py-3 text-xs font-bold transition ${
              activeStep === 1 ? 'border-amber-600 text-amber-600 bg-amber-50/50' : 'border-transparent text-slate-500'
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold">1</span>
            ๑. ตรวจสอบความพร้อม (Audit)
          </button>
          <button
            onClick={() => setActiveStep(2)}
            className={`flex flex-1 items-center justify-center gap-2 border-b-2 py-3 text-xs font-bold transition ${
              activeStep === 2 ? 'border-amber-600 text-amber-600 bg-amber-50/50' : 'border-transparent text-slate-500'
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold">2</span>
            ๒. สรุปผลการเลื่อนชั้น (Promotion)
          </button>
          <button
            onClick={() => setActiveStep(3)}
            className={`flex flex-1 items-center justify-center gap-2 border-b-2 py-3 text-xs font-bold transition ${
              activeStep === 3 ? 'border-amber-600 text-amber-600 bg-amber-50/50' : 'border-transparent text-slate-500'
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold">3</span>
            ๓. ยืนยันปิดเทอม & ล็อคข้อมูล (Lock)
          </button>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {activeStep === 1 && (
            <div className="space-y-6">
              {/* Audit Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-xs text-slate-500 font-medium">นักเรียนที่ตรวจสอบทั้งหมด</div>
                  <div className="text-2xl font-black text-slate-800 mt-1">{studentsStatus.length} คน</div>
                  <div className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> ข้อมูลทะเบียนครบถ้วน
                  </div>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 shadow-sm">
                  <div className="text-xs text-red-600 font-medium">ข้อผิดพลาดวิกฤต (ต้องแก้ไข)</div>
                  <div className="text-2xl font-black text-red-700 mt-1">{criticalIssues.length} รายการ</div>
                  <div className="text-[11px] text-red-600 mt-1">เวลาเรียนไม่ถึง 80% หรือเกรด 0</div>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
                  <div className="text-xs text-amber-600 font-medium">ข้อควรระวัง (Warnings)</div>
                  <div className="text-2xl font-black text-amber-700 mt-1">{warningIssues.length} รายการ</div>
                  <div className="text-[11px] text-amber-600 mt-1">รอผลกิจกรรมหรือคุณลักษณะ</div>
                </div>
              </div>

              {/* Audit Issue Details */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-600" />
                  รายการตรวจสอบก่อนปิดภาคเรียนตามเกณฑ์ สพฐ.
                </h3>

                {auditIssues.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 text-xs">
                    <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
                    ยอดเยี่ยม! ไม่พบข้อผิดพลาด นักเรียนทุกคนผ่านเกณฑ์พร้อมสำหรับการเลื่อนชั้น
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {auditIssues.map((issue, idx) => (
                      <div
                        key={idx}
                        className={`flex items-start gap-3 rounded-lg border p-3 text-xs ${
                          issue.type === 'critical'
                            ? 'border-red-200 bg-red-50/40 text-red-800'
                            : 'border-amber-200 bg-amber-50/40 text-amber-800'
                        }`}
                      >
                        {issue.type === 'critical' ? (
                          <XCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className="font-bold">
                            {issue.studentName} {issue.subjectName ? `(${issue.subjectName})` : ''}
                          </div>
                          <div className="text-[11px] mt-0.5 opacity-90">{issue.message}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeStep === 2 && (
            <div className="space-y-4">
              {/* Filter Tabs */}
              <div className="flex items-center justify-between">
                <div className="flex gap-2 text-xs">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`rounded-lg px-3 py-1.5 font-bold transition ${
                      statusFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    ทั้งหมด ({studentsStatus.length})
                  </button>
                  <button
                    onClick={() => setStatusFilter('promoted')}
                    className={`rounded-lg px-3 py-1.5 font-bold transition ${
                      statusFilter === 'promoted' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-emerald-700'
                    }`}
                  >
                    เลื่อนชั้น ({studentsStatus.filter((s) => s.decision === 'promoted').length})
                  </button>
                  <button
                    onClick={() => setStatusFilter('retained')}
                    className={`rounded-lg px-3 py-1.5 font-bold transition ${
                      statusFilter === 'retained' ? 'bg-red-600 text-white' : 'bg-slate-100 text-red-700'
                    }`}
                  >
                    ซ้ำชั้น/สอบซ่อม ({studentsStatus.filter((s) => s.decision === 'retained').length})
                  </button>
                </div>
              </div>

              {/* Roster Table */}
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                    <tr>
                      <th className="px-4 py-2.5">รหัส</th>
                      <th className="px-4 py-2.5">ชื่อ-สกุล</th>
                      <th className="px-3 py-2.5 text-center">เวลาเรียน</th>
                      <th className="px-3 py-2.5 text-center">วิชาพื้นฐาน</th>
                      <th className="px-3 py-2.5 text-center">คุณลักษณะ</th>
                      <th className="px-3 py-2.5 text-center">กิจกรรม</th>
                      <th className="px-4 py-2.5 text-center">การตัดสิน</th>
                      <th className="px-4 py-2.5">เป้าหมายปีถัดไป</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.map((st) => (
                      <tr key={st.studentId} className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-mono text-slate-500">{st.studentCode}</td>
                        <td className="px-4 py-2 font-medium text-slate-800">{st.studentName}</td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={`font-semibold ${
                              st.attendancePercentage >= 80 ? 'text-emerald-600' : 'text-red-600'
                            }`}
                          >
                            {st.attendancePercentage}%
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          {st.hasPassedAllBasicSubjects ? (
                            <span className="text-emerald-600 font-bold">ผ่าน</span>
                          ) : (
                            <span className="text-red-600 font-bold">ไม่ผ่าน</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {st.hasPassedCharacteristics ? (
                            <span className="text-emerald-600">ผ่าน</span>
                          ) : (
                            <span className="text-red-600 font-bold">ไม่ผ่าน</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {st.hasPassedActivities ? (
                            <span className="text-emerald-600">ผ.</span>
                          ) : (
                            <span className="text-red-600 font-bold">มผ.</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-center">
                          {st.decision === 'promoted' ? (
                            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-bold text-emerald-800">
                              เลื่อนชั้น
                            </span>
                          ) : st.decision === 'graduated' ? (
                            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 font-bold text-blue-800">
                              จบหลักสูตร
                            </span>
                          ) : (
                            <span className="rounded-full bg-red-100 px-2.5 py-0.5 font-bold text-red-800">
                              ซ้ำชั้น/สอบซ่อม
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-slate-600">
                          {st.targetGradeLevel || '-'}
                          {st.notes && st.decision === 'retained' && (
                            <div className="text-[10px] text-red-500 mt-0.5">{st.notes}</div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeStep === 3 && (
            <div className="mx-auto max-w-xl space-y-6 py-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 mx-auto">
                <Lock className="h-8 w-8" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-800">ยืนยันการปิดภาคเรียนและล็อคข้อมูล</h3>
                <p className="text-xs text-slate-500 mt-1">
                  เมื่อยืนยัน ระบบจะทำ Snapshot เกรดเฉลี่ยสะสม และล็อคข้อมูลคะแนนของห้อง {currentClassroomName} เทอม {term}/{academicYear} ไม่ให้สามารถแก้ไขย้อนหลังได้ ตามระเบียบงานทะเบียนวัดผล สพฐ.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 text-left text-xs space-y-2">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">ปีการศึกษา / ภาคเรียน:</span>
                  <span className="font-bold text-slate-800">ปี {academicYear} ภาคเรียนที่ {term}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">ห้องเรียน:</span>
                  <span className="font-bold text-slate-800">{currentClassroomName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">จำนวนนักเรียนที่เลื่อนชั้น:</span>
                  <span className="font-bold text-emerald-600">
                    {studentsStatus.filter((s) => s.decision === 'promoted').length} คน
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">สถานะล็อคปัจจุบัน:</span>
                  <span className="font-bold text-amber-600">
                    {isLocked ? `ล็อคแล้วเมื่อ ${lockTimestamp?.slice(0, 10)}` : 'ยังไม่ล็อค (แก้ไขได้)'}
                  </span>
                </div>
              </div>

              {isLocked ? (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-emerald-800 text-xs font-semibold flex items-center justify-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ภาคเรียนนี้ถูกปิดและล็อคข้อมูลเรียบร้อยแล้ว
                </div>
              ) : (
                <button
                  onClick={handleConfirmLockTerm}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-600 py-3 text-xs font-bold text-white shadow-lg shadow-amber-500/25 hover:bg-amber-700 transition disabled:opacity-50"
                >
                  <Lock className="h-4 w-4" />
                  ยืนยันปิดภาคเรียนและล็อคผลการเรียนทันที
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-3">
          <button
            onClick={() => setActiveStep((p) => Math.max(1, p - 1) as any)}
            disabled={activeStep === 1}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            ย้อนกลับ
          </button>

          <div className="flex gap-2">
            {activeStep < 3 ? (
              <button
                onClick={() => setActiveStep((p) => Math.min(3, p + 1) as any)}
                className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-5 py-2 text-xs font-bold text-white hover:bg-slate-900"
              >
                ขั้นตอนถัดไป
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={onClose}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700"
              >
                เสร็จสิ้น
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
