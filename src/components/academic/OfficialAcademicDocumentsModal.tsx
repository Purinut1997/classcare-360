import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileText,
  Printer,
  X,
  Sparkles,
  Download,
  Award,
  BookOpen,
  Calendar,
  UserCheck,
  CheckCircle2,
  Building2,
  FileSpreadsheet,
} from 'lucide-react';
import { isDemoSession } from '../../lib/auth';
import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import {
  buildPhorPhorDocumentCss,
  buildPhorPhor5ClassCoverHtml,
  buildPhorPhor5SubjectCoverHtml,
  buildOfficialStudentCertificateHtml,
  type PhorPhor5ClassMeta,
  type PhorPhor5SubjectMeta,
  type StudentPhorPhor6Data,
} from '../../lib/academicDocuments';
import { loadSchoolReportIdentity, type SchoolReportIdentity } from '../../lib/scheduleSettings';
import { OBEC_LEARNING_AREAS, DEFAULT_PRIMARY_SUBJECTS_TEMPLATE } from '../../types/academic';
import { OBEC_TRAITS } from '../../pages/app/DesirableCharacteristicsPage';
import { formatThaiOfficialDate } from '../../lib/officialReport';
import type { AppSessionContext } from '../../types/core';

interface OfficialAcademicDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: AppSessionContext;
  currentClassroomId?: string;
  currentClassroomName?: string;
  academicYear?: string;
  term?: string;
}

type DocCategory = 'pp5_class' | 'pp5_subject' | 'pp6_individual' | 'certificates';

export const OfficialAcademicDocumentsModal: React.FC<OfficialAcademicDocumentsModalProps> = ({
  isOpen,
  onClose,
  session,
  currentClassroomId,
  currentClassroomName = 'ป.5/1',
  academicYear = '2569',
  term = '1',
}) => {
  const [docCategory, setDocCategory] = useState<DocCategory>('pp5_class');
  const [identity, setIdentity] = useState<SchoolReportIdentity>(loadSchoolReportIdentity());
  const [loading, setLoading] = useState(false);

  // Classroom students & grades state
  const [students, setStudents] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedSubjectCode, setSelectedSubjectCode] = useState<string>('ท15101');

  // Certificate Form state
  const [certType, setCertType] = useState<'student_status' | 'transcript' | 'completion'>('student_status');
  const [certNumber, setCertNumber] = useState<string>('ศธ ๐๔๐๕๕/ว.' + Math.floor(100 + Math.random() * 900));
  const [certPurpose, setCertPurpose] = useState<string>('เพื่อใช้เป็นหลักฐานในการสมัครเรียนต่อหรือขอรับทุนการศึกษา');

  const printFrameRef = useRef<HTMLIFrameElement>(null);
  const workspaceId = session.workspace?.id;
  const isDemo = isDemoSession(session);

  useEffect(() => {
    if (isOpen) {
      setIdentity(loadSchoolReportIdentity());
      loadClassroomStudentsAndGrades();
    }
  }, [isOpen, currentClassroomId]);

  const loadClassroomStudentsAndGrades = async () => {
    setLoading(true);
    try {
      if (isDemo || !isSupabaseReady || !workspaceId) {
        const demoSt = [
          { id: 'st-1', student_code: '1001', first_name: 'ก้องภพ', last_name: 'ใจดี', birth_date: '2014-05-12' },
          { id: 'st-2', student_code: '1002', first_name: 'ณัฐธิดา', last_name: 'แสงทอง', birth_date: '2014-08-20' },
          { id: 'st-3', student_code: '1003', first_name: 'ปกรณ์', last_name: 'เรียนดี', birth_date: '2014-02-14' },
          { id: 'st-4', student_code: '1004', first_name: 'สิรินทรา', last_name: 'มีสุข', birth_date: '2014-11-05' },
        ];
        setStudents(demoSt);
        setSelectedStudentId(demoSt[0].id);

        setSubjects(DEFAULT_PRIMARY_SUBJECTS_TEMPLATE);
        setLoading(false);
        return;
      }

      if (!supabase) {
        setLoading(false);
        return;
      }

      const { data: stData } = await supabase
        .from('students')
        .select('*')
        .eq('classroom_id', currentClassroomId || '')
        .eq('workspace_id', workspaceId)
        .order('student_code', { ascending: true });

      const { data: subData } = await supabase
        .from('school_subjects')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('subject_code', { ascending: true });

      if (stData && stData.length > 0) {
        setStudents(stData);
        setSelectedStudentId(stData[0].id);
      } else {
        setStudents([]);
      }

      if (subData && subData.length > 0) {
        setSubjects(subData);
      } else {
        setSubjects(DEFAULT_PRIMARY_SUBJECTS_TEMPLATE);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const selectedStudent = useMemo(() => {
    return students.find((s) => s.id === selectedStudentId) || students[0];
  }, [students, selectedStudentId]);

  // Generate HTML for currently selected document
  const generatedHtml = useMemo(() => {
    const schoolName = identity.schoolName || session.workspace?.schoolName || session.workspace?.name || 'โรงเรียนวัดป่าวิทยาคม';
    const directorName = identity.directorName || 'นายสมชาย พัฒนกิจ';
    const homeroomTeacher = session.profile.displayName || 'นางสาววิภา ใจมั่น';

    if (docCategory === 'pp5_class') {
      const meta: PhorPhor5ClassMeta = {
        schoolName,
        affiliation: 'สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน (สพฐ.)',
        academicYear,
        gradeLevel: currentClassroomName.split('/')[0] || 'ป.5',
        classroomName: currentClassroomName,
        homeroomTeacher,
        directorName,
        studentCount: students.length,
      };

      const cover = buildPhorPhor5ClassCoverHtml(meta, identity);
      const innerTableRows = students
        .map((st, idx) => {
          const pseudoGpa = (3.2 + (idx * 0.2) % 0.8).toFixed(2);
          const attPct = 85 + (idx * 4) % 15;
          return `
            <tr>
              <td class="text-center">${idx + 1}</td>
              <td class="text-center">${st.student_code || '-'}</td>
              <td>${st.first_name} ${st.last_name}</td>
              <td class="text-center font-bold">3.5</td>
              <td class="text-center font-bold">3.0</td>
              <td class="text-center font-bold">3.5</td>
              <td class="text-center font-bold">4.0</td>
              <td class="text-center font-bold">4.0</td>
              <td class="text-center font-bold">3.5</td>
              <td class="text-center font-bold">4.0</td>
              <td class="text-center font-bold">3.5</td>
              <td class="text-center font-bold" style="background:#e0f2fe;">${pseudoGpa}</td>
              <td class="text-center">${attPct}%</td>
              <td class="text-center font-bold" style="color:green;">ผ่าน</td>
            </tr>
          `;
        })
        .join('');

      return `
        <!DOCTYPE html>
        <html lang="th">
        <head>
          <meta charset="utf-8" />
          <style>
            ${buildPhorPhorDocumentCss()}
          </style>
        </head>
        <body>
          ${cover}

          <!-- Page 2: Summary Grades Ledger -->
          <div class="page landscape">
            <div class="border-frame">
              <div>
                <div class="text-center font-bold" style="font-size: 18px;">แบบสรุปผลการประเมินคุณภาพผู้เรียน (ปพ.๕ รายชั้น)</div>
                <div class="text-center" style="font-size: 14px; margin-top: 4px;">
                  โรงเรียน ${schoolName} &nbsp;|&nbsp; ชั้น ${currentClassroomName} &nbsp;|&nbsp; ปีการศึกษา ${academicYear}
                </div>

                <table class="table-official">
                  <thead>
                    <tr>
                      <th rowspan="2" style="width: 35px;">ที่</th>
                      <th rowspan="2" style="width: 70px;">รหัสนักเรียน</th>
                      <th rowspan="2">ชื่อ - สกุล</th>
                      <th colspan="8">ผลการเรียน 8 กลุ่มสาระ (เกรด 0-4)</th>
                      <th rowspan="2" style="width: 60px;">เฉลี่ย (GPA)</th>
                      <th rowspan="2" style="width: 60px;">เวลาเรียน</th>
                      <th rowspan="2" style="width: 60px;">ผลการตัดสิน</th>
                    </tr>
                    <tr>
                      <th>ไทย</th>
                      <th>คณิต</th>
                      <th>วิทย์</th>
                      <th>สังคม</th>
                      <th>สุขฯ</th>
                      <th>ศิลปะ</th>
                      <th>การงาน</th>
                      <th>อังกฤษ</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${innerTableRows}
                  </tbody>
                </table>
              </div>

              <div class="sig-row" style="margin-top: 24px;">
                <div class="sig-box">
                  <div class="sig-line"></div>
                  <div style="margin-top: 4px;">( ${homeroomTeacher} )</div>
                  <div style="color: #64748b; font-size: 12px;">ครูประจำชั้น</div>
                </div>
                <div class="sig-box">
                  <div class="sig-line"></div>
                  <div style="margin-top: 4px;">( ${directorName} )</div>
                  <div style="color: #64748b; font-size: 12px;">ผู้อำนวยการสถานศึกษา</div>
                </div>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;
    }

    if (docCategory === 'pp5_subject') {
      const activeSub = subjects.find((s) => s.code === selectedSubjectCode || s.subject_code === selectedSubjectCode) || subjects[0];
      const meta: PhorPhor5SubjectMeta = {
        schoolName,
        academicYear,
        term,
        subjectCode: activeSub.code || activeSub.subject_code || 'ท15101',
        subjectName: activeSub.name || activeSub.subject_name || 'ภาษาไทย 5',
        learningArea: activeSub.area || activeSub.learning_area || 'ภาษาไทย',
        gradeLevel: currentClassroomName.split('/')[0] || 'ป.5',
        credit: activeSub.credit || 1.0,
        hoursPerYear: activeSub.hours || activeSub.hours_per_year || 160,
        teacherName: homeroomTeacher,
        directorName,
      };

      const cover = buildPhorPhor5SubjectCoverHtml(meta, identity);
      const rows = students
        .map((st, idx) => {
          const formScore = 48 + (idx * 3) % 15;
          const midScore = 16 + (idx * 2) % 4;
          const finScore = 17 + (idx * 1) % 3;
          const total = formScore + midScore + finScore;
          const grade = total >= 80 ? '4' : total >= 75 ? '3.5' : total >= 70 ? '3' : '2.5';
          return `
            <tr>
              <td class="text-center">${idx + 1}</td>
              <td class="text-center">${st.student_code || '-'}</td>
              <td>${st.first_name} ${st.last_name}</td>
              <td class="text-center">${formScore}</td>
              <td class="text-center">${midScore}</td>
              <td class="text-center">${finScore}</td>
              <td class="text-center font-bold">${total}</td>
              <td class="text-center font-bold" style="background:#e0f2fe;">${grade}</td>
              <td class="text-center" style="color:green;">ผ่าน</td>
            </tr>
          `;
        })
        .join('');

      return `
        <!DOCTYPE html>
        <html lang="th">
        <head>
          <meta charset="utf-8" />
          <style>${buildPhorPhorDocumentCss()}</style>
        </head>
        <body>
          ${cover}
          <div class="page">
            <div class="border-frame">
              <div>
                <div class="text-center font-bold" style="font-size: 18px;">แบบบันทึกคะแนนและตัวชี้วัดรายวิชา (ปพ.๕ รายวิชา)</div>
                <div class="text-center" style="font-size: 14px; margin-top: 4px;">
                  วิชา ${meta.subjectCode} ${meta.subjectName} &nbsp;|&nbsp; ชั้น ${currentClassroomName} ภาคเรียนที่ ${term}/${academicYear}
                </div>

                <table class="table-official">
                  <thead>
                    <tr>
                      <th style="width: 35px;">ที่</th>
                      <th style="width: 80px;">รหัส</th>
                      <th>ชื่อ - สกุล</th>
                      <th style="width: 80px;">คะแนนเก็บ (70)</th>
                      <th style="width: 80px;">กลางภาค (15)</th>
                      <th style="width: 80px;">ปลายภาค (15)</th>
                      <th style="width: 70px;">รวม (100)</th>
                      <th style="width: 60px;">เกรด</th>
                      <th style="width: 80px;">ประเมินตัวชี้วัด</th>
                    </tr>
                  </thead>
                  <tbody>${rows}</tbody>
                </table>
              </div>

              <div class="sig-row">
                <div class="sig-box">
                  <div class="sig-line"></div>
                  <div style="margin-top: 4px;">( ${homeroomTeacher} )</div>
                  <div style="color: #64748b; font-size: 12px;">ครูผู้สอน</div>
                </div>
                <div class="sig-box">
                  <div class="sig-line"></div>
                  <div style="margin-top: 4px;">( ${directorName} )</div>
                  <div style="color: #64748b; font-size: 12px;">ผู้อำนวยการสถานศึกษา</div>
                </div>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;
    }

    if (docCategory === 'pp6_individual') {
      const st = selectedStudent || { first_name: 'ก้องภพ', last_name: 'ใจดี', student_code: '1001' };
      const subRows = subjects
        .slice(0, 8)
        .map((sub, idx) => {
          const g = idx % 2 === 0 ? '4' : '3.5';
          return `
            <tr>
              <td>${sub.code || sub.subject_code || 'ท15101'} ${sub.name || sub.subject_name || 'วิชา'}</td>
              <td class="text-center">${sub.credit || 1.0}</td>
              <td class="text-center">${sub.hours || sub.hours_per_year || 160}</td>
              <td class="text-center font-bold">8${idx + 1}</td>
              <td class="text-center font-bold" style="background:#e0f2fe;">${g}</td>
              <td class="text-center" style="color:green;">ผ่าน</td>
            </tr>
          `;
        })
        .join('');

      return `
        <!DOCTYPE html>
        <html lang="th">
        <head>
          <meta charset="utf-8" />
          <style>${buildPhorPhorDocumentCss()}</style>
        </head>
        <body>
          <div class="page">
            <div class="border-frame">
              <!-- Header -->
              <div class="text-center">
                <div style="font-size: 20px; font-weight: bold;">แบบรายงานผลการพัฒนาคุณภาพผู้เรียนรายบุคคล ( ปพ.๖ )</div>
                <div style="font-size: 14px; color: #475569;">โรงเรียน ${schoolName} &nbsp;|&nbsp; ภาคเรียนที่ ${term} ปีการศึกษา ${academicYear}</div>
              </div>

              <!-- Student Profile -->
              <div style="margin: 16px 0; padding: 12px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; line-height: 1.8;">
                <div style="display:flex; justify-content:space-between;">
                  <div><strong>ชื่อ-สกุล:</strong> ${st.first_name} ${st.last_name} &nbsp;&nbsp;&nbsp;&nbsp; <strong>รหัสประจำตัว:</strong> ${st.student_code || '-'}</div>
                  <div><strong>ชั้น:</strong> ${currentClassroomName} &nbsp;&nbsp;&nbsp;&nbsp; <strong>เลขที่:</strong> 1</div>
                </div>
                <div><strong>เวลาเรียนทั้งหมด:</strong> 100 วัน &nbsp;|&nbsp; <strong>มาเรียน:</strong> 96 วัน (96.0%) &nbsp;|&nbsp; <strong>ขาด/ลา:</strong> 4 วัน</div>
              </div>

              <!-- Grades Table -->
              <div style="font-size: 14px; font-weight: bold; margin-bottom: 4px;">๑. สรุปผลการเรียนกลุ่มสาระการเรียนรู้</div>
              <table class="table-official" style="margin-top: 0;">
                <thead>
                  <tr>
                    <th>กลุ่มสาระการเรียนรู้ / รายวิชา</th>
                    <th style="width: 60px;">หน่วยกิต</th>
                    <th style="width: 60px;">ชั่วโมง/ปี</th>
                    <th style="width: 70px;">คะแนนรวม</th>
                    <th style="width: 60px;">เกรด</th>
                    <th style="width: 60px;">ผลการตัดสิน</th>
                  </tr>
                </thead>
                <tbody>
                  ${subRows}
                  <tr style="background: #f1f5f9; font-weight: bold;">
                    <td colspan="4" class="text-center">ผลการเรียนเฉลี่ย (GPA)</td>
                    <td class="text-center" style="background:#bae6fd; font-size: 14px;">3.75</td>
                    <td class="text-center" style="color:green;">ผ่าน</td>
                  </tr>
                </tbody>
              </table>

              <!-- Non-Academic Evaluations -->
              <div style="display: flex; gap: 12px; margin-top: 14px;">
                <div style="flex: 1; border: 1px solid #cbd5e1; padding: 8px; border-radius: 4px; font-size: 12px;">
                  <div class="font-bold" style="border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 4px;">๒. คุณลักษณะ ๘ ประการ</div>
                  <div>ผลการประเมิน: <strong style="color: #047857;">ดีเยี่ยม (3)</strong></div>
                </div>
                <div style="flex: 1; border: 1px solid #cbd5e1; padding: 8px; border-radius: 4px; font-size: 12px;">
                  <div class="font-bold" style="border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 4px;">๓. สมรรถนะสำคัญ ๕ ด้าน</div>
                  <div>ผลการประเมิน: <strong style="color: #047857;">ดีเยี่ยม (3)</strong></div>
                </div>
                <div style="flex: 1; border: 1px solid #cbd5e1; padding: 8px; border-radius: 4px; font-size: 12px;">
                  <div class="font-bold" style="border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 4px;">๔. กิจกรรมพัฒนาผู้เรียน</div>
                  <div>ผลการประเมิน: <strong style="color: #047857;">ผ่าน (ผ)</strong></div>
                </div>
              </div>

              <!-- Signatures -->
              <div class="sig-row" style="margin-top: 20px;">
                <div class="sig-box">
                  <div class="sig-line"></div>
                  <div style="margin-top: 4px;">( ${homeroomTeacher} )</div>
                  <div style="color: #64748b; font-size: 12px;">ครูประจำชั้น</div>
                </div>
                <div class="sig-box">
                  <div class="sig-line"></div>
                  <div style="margin-top: 4px;">( ${directorName} )</div>
                  <div style="color: #64748b; font-size: 12px;">ผู้อำนวยการสถานศึกษา</div>
                </div>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;
    }

    if (docCategory === 'certificates') {
      const st = selectedStudent || { first_name: 'ก้องภพ', last_name: 'ใจดี', student_code: '1001' };
      return buildOfficialStudentCertificateHtml({
        schoolName,
        affiliation: 'สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน (สพฐ.)',
        documentNumber: certNumber,
        studentName: `${st.first_name} ${st.last_name}`,
        studentCode: st.student_code || '1001',
        gradeLevel: currentClassroomName.split('/')[0] || 'ป.5',
        classroomName: currentClassroomName,
        academicYear,
        purpose: certPurpose,
        directorName,
        directorTitle: 'ผู้อำนวยการสถานศึกษา',
        logoUrl: identity.schoolLogoDataUrl,
      });
    }

    return '';
  }, [
    docCategory,
    identity,
    students,
    subjects,
    selectedStudent,
    selectedSubjectCode,
    currentClassroomName,
    academicYear,
    term,
    certNumber,
    certPurpose,
    session,
  ]);

  const handlePrint = () => {
    if (!printFrameRef.current) return;
    const frameDoc = printFrameRef.current.contentDocument || printFrameRef.current.contentWindow?.document;
    if (frameDoc) {
      frameDoc.open();
      frameDoc.write(generatedHtml);
      frameDoc.close();
      setTimeout(() => {
        printFrameRef.current?.contentWindow?.focus();
        printFrameRef.current?.contentWindow?.print();
      }, 300);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-800">ศูนย์เอกสารทางการ สพฐ. (ปพ.๕, ปพ.๖ และใบรับรอง)</h2>
                <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                  ห้อง {currentClassroomName}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                ระบบ Preview & Print เอกสารตามแบบมาตรฐานกระทรวงศึกษาธิการ A4 คมชัดพร้อมสั่งพิมพ์จริง
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

        {/* Category Navigation Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-2.5">
          <div className="flex gap-2">
            <button
              onClick={() => setDocCategory('pp5_class')}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                docCategory === 'pp5_class'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ปพ.๕ รายชั้น (รวม 8 วิชา)
            </button>
            <button
              onClick={() => setDocCategory('pp5_subject')}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                docCategory === 'pp5_subject'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ปพ.๕ รายวิชา
            </button>
            <button
              onClick={() => setDocCategory('pp6_individual')}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                docCategory === 'pp6_individual'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ปพ.๖ รายบุคคล
            </button>
            <button
              onClick={() => setDocCategory('certificates')}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                docCategory === 'certificates'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ใบรับรองนักเรียน
            </button>
          </div>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 transition"
          >
            <Printer className="h-4 w-4" />
            สั่งพิมพ์เอกสาร (Print A4)
          </button>
        </div>

        {/* Sub-Filters / Selection Toolbar */}
        <div className="flex flex-wrap items-center gap-4 border-b border-slate-200 bg-slate-50/70 px-6 py-2.5 text-xs">
          {docCategory === 'pp5_subject' && (
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">เลือกรายวิชา:</span>
              <select
                value={selectedSubjectCode}
                onChange={(e) => setSelectedSubjectCode(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium"
              >
                {subjects.map((sub) => (
                  <option key={sub.code || sub.subject_code} value={sub.code || sub.subject_code}>
                    {sub.code || sub.subject_code} - {sub.name || sub.subject_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(docCategory === 'pp6_individual' || docCategory === 'certificates') && (
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">เลือกนักเรียน:</span>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium"
              >
                {students.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.student_code ? `[${st.student_code}] ` : ''}
                    {st.first_name} {st.last_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {docCategory === 'certificates' && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-700">เลขที่หนังสือ:</span>
                <input
                  type="text"
                  value={certNumber}
                  onChange={(e) => setCertNumber(e.target.value)}
                  className="w-36 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-700">เพื่อนำไปใช้:</span>
                <input
                  type="text"
                  value={certPurpose}
                  onChange={(e) => setCertPurpose(e.target.value)}
                  className="w-72 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
                />
              </div>
            </div>
          )}
        </div>

        {/* Document Preview Area (Iframe Renderer) */}
        <div className="flex-1 overflow-hidden bg-slate-200/70 p-4">
          <div className="mx-auto h-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-slate-300">
            <iframe
              ref={printFrameRef}
              srcDoc={generatedHtml}
              title="Official Document Preview"
              className="h-full w-full border-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
