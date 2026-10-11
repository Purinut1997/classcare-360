import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
  Copy,
  Layers,
  GraduationCap,
  Upload,
  Image as ImageIcon,
  Trash2,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  Save,
  Check,
  Settings2,
} from 'lucide-react';
import { isDemoSession } from '../../lib/auth';
import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import {
  loadSchoolReportIdentity,
  saveSchoolReportIdentity,
  compressImageFile,
  type SchoolReportIdentity,
} from '../../lib/scheduleSettings';
import { writeAuditLog } from '../../lib/auditLog';
import { formatThaiOfficialDate } from '../../lib/officialReport';
import type { AppSessionContext } from '../../types/core';
import { UniversalPhorPhor6Viewer } from './UniversalPhorPhor6Viewer';
import { UniversalPhorPhor5Viewer } from './UniversalPhorPhor5Viewer';
import { OBECSchoolHeader, fetchRealAcademicDataForClassroom, RealClassroomAcademicPayload } from '../../lib/obecAcademicEngine';
import { P5_MASTER_DATA, getPrimaryMasterData } from '../../data/p5MasterTemplate';
import { printElementAsDocument } from '../../lib/academicPrintService';

interface OfficialAcademicDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: AppSessionContext;
  currentClassroomId?: string;
  currentClassroomName?: string;
  academicYear?: string;
  term?: string;
  initialCategory?: DocCategory;
  initialStudentId?: string;
}

type DocCategory = 'pp6_individual' | 'pp5_suite' | 'certificates' | 'settings';

export const OfficialAcademicDocumentsModal: React.FC<OfficialAcademicDocumentsModalProps> = ({
  isOpen,
  onClose,
  session,
  currentClassroomId,
  currentClassroomName = 'ป.5/1',
  academicYear = '2568',
  term = '1',
  initialCategory = 'pp6_individual',
  initialStudentId,
}) => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docCategory, setDocCategory] = useState<DocCategory>(initialCategory);
  const [identity, setIdentity] = useState<SchoolReportIdentity>(() => {
    const stored = loadSchoolReportIdentity(session.workspace?.id);
    return {
      ...stored,
      schoolName: session.workspace?.schoolName || stored.schoolName || 'โรงเรียนบ้านหนองไฮ่ย',
    };
  });
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [saveNotice, setSaveNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [realPayload, setRealPayload] = useState<RealClassroomAcademicPayload | null>(null);
  const certSheetRef = React.useRef<HTMLDivElement>(null);
  const [isPrintingCert, setIsPrintingCert] = useState(false);

  useEffect(() => {
    if (initialCategory && isOpen) {
      setDocCategory(initialCategory);
    }
  }, [initialCategory, isOpen]);

  // ห้องเรียนทั้งหมดที่เปิดสอนในโรงเรียน
  const [classrooms, setClassrooms] = useState<{ id: string; name: string }[]>([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>(currentClassroomId || '');
  const [selectedClassroomName, setSelectedClassroomName] = useState<string>(currentClassroomName);

  // ข้อมูลนักเรียนในห้องเรียนที่เลือก
  const [students, setStudents] = useState<any[]>([]);

  // Certificate Form state
  const [certType, setCertType] = useState<'student_status' | 'transcript' | 'completion'>('student_status');
  const [selectedCertStudentId, setSelectedCertStudentId] = useState<string>('');
  const [certNumber, setCertNumber] = useState<string>('ศธ ๐๔๐๕๕/ว.' + Math.floor(100 + Math.random() * 900));
  const [certPurpose, setCertPurpose] = useState<string>('เพื่อใช้เป็นหลักฐานในการสมัครเรียนต่อหรือขอรับทุนการศึกษา');

  const workspaceId = session.workspace?.id;
  const isDemo = isDemoSession(session);

  // ข้อมูลหัวจดหมายโรงเรียนมาตรฐาน สพฐ.
  const schoolHeader: OBECSchoolHeader = useMemo(() => ({
    schoolName: identity.schoolName || session.workspace?.schoolName || 'โรงเรียนบ้านหนองไฮ่ย',
    district: identity.district || 'อ.ขุขันธ์',
    province: identity.province || 'จ.ศรีสะเกษ',
    jurisdiction: identity.jurisdiction || 'สำนักงานเขตพื้นที่การศึกษาประถมศึกษา ศรีสะเกษ เขต 3',
    directorName: identity.directorName || 'นางสาวนิตยาภรณ์ ตรีแก้ว',
    directorPosition: identity.directorPosition || 'ผู้อำนวยการสถานศึกษา',
    academicHeadName: identity.academicHeadName || 'นางมุณี ทองแท้',
    registrarName: identity.registrarName || 'นายภูริณัฐ กุลัพบุรี',
    homeroomTeacherName: identity.teacherName || 'นายภูริณัฐ กุลัพบุรี',
    schoolLogoDataUrl: identity.useGarudaInsteadOfLogo ? '' : identity.schoolLogoDataUrl,
    useGarudaInsteadOfLogo: identity.useGarudaInsteadOfLogo,
  }), [identity, session.workspace?.schoolName]);

  const loadWorkspaceData = async () => {
    try {
      // 1. โหลดจาก localStorage ที่แยกตาม workspaceId
      const stored = loadSchoolReportIdentity(workspaceId);
      let merged: SchoolReportIdentity = {
        ...stored,
        schoolName: session.workspace?.schoolName || stored.schoolName || 'โรงเรียนบ้านหนองไฮ่ย',
      };

      // 2. หากเชื่อมต่อ Supabase สำเร็จ ให้ดึงการตั้งค่าจริงจากตาราง workspaces
      if (!isDemo && isSupabaseReady && supabase && workspaceId) {
        const { data: wsData, error: wsError } = await supabase
          .from('workspaces')
          .select('name, school_name, academic_year, settings')
          .eq('id', workspaceId)
          .maybeSingle();

        if (!wsError && wsData) {
          const rep = ((wsData.settings as any)?.report_identity || {}) as Partial<SchoolReportIdentity>;
          merged = {
            ...merged,
            schoolName: wsData.school_name || rep.schoolName || merged.schoolName,
            directorName: rep.directorName ?? merged.directorName,
            directorPosition: rep.directorPosition ?? merged.directorPosition ?? 'ผู้อำนวยการสถานศึกษา',
            teacherName: rep.teacherName ?? merged.teacherName,
            academicHeadName: rep.academicHeadName ?? merged.academicHeadName,
            registrarName: rep.registrarName ?? merged.registrarName,
            coAdvisorName: rep.coAdvisorName ?? merged.coAdvisorName,
            schoolLogoDataUrl: rep.schoolLogoDataUrl || merged.schoolLogoDataUrl || '',
            district: rep.district || merged.district || 'อ.ขุขันธ์',
            province: rep.province || merged.province || 'จ.ศรีสะเกษ',
            jurisdiction: rep.jurisdiction || merged.jurisdiction || 'สำนักงานเขตพื้นที่การศึกษาประถมศึกษา ศรีสะเกษ เขต 3',
            useGarudaInsteadOfLogo: rep.useGarudaInsteadOfLogo ?? merged.useGarudaInsteadOfLogo ?? false,
          };
          saveSchoolReportIdentity(merged, workspaceId);
        }
      }

      setIdentity(merged);
    } catch (err) {
      console.warn('[OfficialAcademicDocumentsModal] Failed to load workspace school identity:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void loadWorkspaceData();
      void loadClassroomsAndStudents();
    }
  }, [isOpen, workspaceId, selectedClassroomId]);

  const loadClassroomsAndStudents = async () => {
    setLoading(true);
    try {
      if (isDemo || !isSupabaseReady || !workspaceId || !supabase) {
        // รายชื่อห้องเรียนมาตรฐานระดับประถมศึกษาและมัธยมศึกษา
        const defaultClassrooms = [
          { id: 'c-p1', name: 'ประถมศึกษาปีที่ 1' },
          { id: 'c-p2', name: 'ประถมศึกษาปีที่ 2' },
          { id: 'c-p3', name: 'ประถมศึกษาปีที่ 3' },
          { id: 'c-p4', name: 'ประถมศึกษาปีที่ 4' },
          { id: 'c-p5', name: 'ประถมศึกษาปีที่ 5' },
          { id: 'c-p6', name: 'ประถมศึกษาปีที่ 6' },
          { id: 'c-m1', name: 'มัธยมศึกษาปีที่ 1' },
          { id: 'c-m2', name: 'มัธยมศึกษาปีที่ 2' },
          { id: 'c-m3', name: 'มัธยมศึกษาปีที่ 3' },
        ];
        setClassrooms(defaultClassrooms);
        const activeRoomId = selectedClassroomId || 'c-p5';
        const activeRoom = defaultClassrooms.find((c) => c.id === activeRoomId) || defaultClassrooms[4];
        if (!selectedClassroomId) {
          setSelectedClassroomId(activeRoom.id);
          setSelectedClassroomName(activeRoom.name);
        }

        // นำข้อมูลจริงตามระดับชั้นที่เลือกจากแม่แบบ (ป.4: 16 คน, ป.5: 20 คน, ป.6: 16 คน)
        const master = getPrimaryMasterData(activeRoom.name);
        const mappedStudents = master.students.map((st, idx) => ({
          id: `st-${st.student_code}`,
          student_code: st.student_code,
          prefix: st.title,
          first_name: st.first_name,
          last_name: st.last_name,
          gender: st.gender,
          birthdate: st.birth_date_thai || st.birth_date,
          address: st.address,
          father_name: st.father_name,
          mother_name: st.mother_name,
          parent_name: st.parent_name,
          parent_relation: st.parent_relation,
          weight: 32 + (idx % 8),
          height: 135 + (idx % 12),
        }));

        setStudents(mappedStudents);
        setSelectedCertStudentId(mappedStudents[0]?.id || '');
        setLoading(false);
        return;
      }

      // ดึง classrooms จาก Supabase
      const { data: cData } = await supabase
        .from('classrooms')
        .select('id, name')
        .eq('workspace_id', workspaceId)
        .order('name');

      if (cData && cData.length > 0) {
        setClassrooms(cData);
        const activeCId = selectedClassroomId || currentClassroomId || cData[0].id;
        setSelectedClassroomId(activeCId);
        const activeName = cData.find((c) => c.id === activeCId)?.name || cData[0].name;
        setSelectedClassroomName(activeName);

        // ดึงข้อมูลจริงจากระบบ: คะแนนสอบจริง, เวลาเรียนจริง, น้ำหนักส่วนสูงจริง
        const realData = await fetchRealAcademicDataForClassroom(
          supabase,
          workspaceId,
          activeCId,
          activeName,
          '1',
          academicYear,
          schoolHeader
        );

        if (realData && realData.students.length > 0) {
          setRealPayload(realData);
          setStudents(realData.students);
          setSelectedCertStudentId(realData.students[0].id);
        } else {
          // ดึงนักเรียนของห้องที่เลือก (กรณีไม่มี assessment)
          const { data: stData } = await supabase
            .from('students')
            .select('*')
            .eq('classroom_id', activeCId)
            .eq('workspace_id', workspaceId)
            .order('student_code', { ascending: true });

          const realStudents = (stData || []) as any[];

          if (realStudents.length > 0) {
            setStudents(realStudents);
            setSelectedCertStudentId(realStudents[0].id);
          } else if (isDemoSession(session)) {
            // fallback ใช้ Master Template เฉพาะในโหมด demo
            const master = getPrimaryMasterData(activeName);
            const mapped = master.students.map((st, idx) => ({
              id: `st-${st.student_code}`,
              student_code: st.student_code,
              prefix: st.title,
              first_name: st.first_name,
              last_name: st.last_name,
              gender: st.gender,
              birthdate: st.birth_date_thai || st.birth_date,
              address: st.address,
              father_name: st.father_name,
              mother_name: st.mother_name,
              parent_name: st.parent_name,
              parent_relation: st.parent_relation,
              weight: 32 + (idx % 8),
              height: 135 + (idx % 12),
            }));
            setStudents(mapped);
            setSelectedCertStudentId(mapped[0]?.id || '');
          } else {
            // Real workspace with 0 students
            setStudents([]);
            setSelectedCertStudentId('');
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setLogoUploading(true);
      const compressedDataUrl = await compressImageFile(file, 520, 0.78);
      setIdentity((prev) => ({
        ...prev,
        schoolLogoDataUrl: compressedDataUrl,
        useGarudaInsteadOfLogo: false,
      }));
      setSaveNotice({
        type: 'info',
        text: 'แนบตราโรงเรียนเรียบร้อยแล้ว กรุณากด "บันทึกข้อมูล" ด้านล่างเพื่อปรับใช้ถาวร',
      });
    } catch (err) {
      console.error('Logo upload error:', err);
      setSaveNotice({
        type: 'error',
        text: 'ไม่สามารถอัปโหลดไฟล์รูปภาพได้ กรุณาใช้ไฟล์ภาพประเภท PNG, JPG หรือ WebP',
      });
    } finally {
      setLogoUploading(false);
      event.target.value = '';
    }
  };

  const handleRemoveLogo = () => {
    setIdentity((prev) => ({
      ...prev,
      schoolLogoDataUrl: '',
    }));
    setSaveNotice({
      type: 'info',
      text: 'นำตราโรงเรียนออกแล้ว (เอกสารจะแสดงตราครุฑพ่าห์ สพฐ. มาตรฐาน)',
    });
  };

  const handleSyncFromWorkspace = async () => {
    setIsSyncing(true);
    setSaveNotice(null);
    try {
      await loadWorkspaceData();
      setSaveNotice({
        type: 'success',
        text: 'ดึงข้อมูลล่าสุดจากระบบและตราโรงเรียนเรียบร้อยแล้ว',
      });
    } catch (err) {
      setSaveNotice({
        type: 'error',
        text: 'ไม่สามารถดึงข้อมูลได้ โปรดลองอีกครั้ง',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveIdentity = async () => {
    setIsSaving(true);
    setSaveNotice(null);

    try {
      // 1. บันทึกลง localStorage ของ workspace
      saveSchoolReportIdentity(identity, workspaceId);

      // 2. บันทึกลง Supabase workspaces หากเชื่อมต่ออยู่
      if (!isDemo && isSupabaseReady && supabase && workspaceId) {
        const { data: currentWs } = await supabase
          .from('workspaces')
          .select('settings')
          .eq('id', workspaceId)
          .maybeSingle();

        const currentSettings = (currentWs?.settings as Record<string, unknown>) || {};

        const { error } = await supabase
          .from('workspaces')
          .update({
            school_name: identity.schoolName,
            settings: {
              ...currentSettings,
              report_identity: identity,
            },
          })
          .eq('id', workspaceId);

        if (error) throw error;

        await writeAuditLog(session, {
          action: 'workspace_settings.updated',
          entityId: workspaceId,
          entityTable: 'workspaces',
          metadata: {
            school_name: identity.schoolName,
            director_name: identity.directorName,
            has_logo: Boolean(identity.schoolLogoDataUrl),
            source: 'official_academic_documents_modal',
          },
          riskLevel: 'low',
          source: 'academic_documents',
        });
      }

      setSaveNotice({
        type: 'success',
        text: 'บันทึกข้อมูลโรงเรียนและตราสัญลักษณ์สำเร็จ! ข้อมูลถูกปรับใช้ในเล่ม ปพ.๕, ปพ.๖ และหนังสือรับรองทุกหน้าทันที',
      });
    } catch (err: any) {
      console.error('Save error:', err);
      setSaveNotice({
        type: 'error',
        text: `เกิดข้อผิดพลาดในการบันทึกข้อมูล: ${err?.message || 'โปรดลองใหม่อีกครั้ง'}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleNavigateToWorkspaceSettings = () => {
    onClose();
    navigate('/app/dashboard?view=workspace-settings#workspace-profile');
  };

  const handleClassroomChange = (cid: string) => {
    setSelectedClassroomId(cid);
    const found = classrooms.find((c) => c.id === cid);
    if (found) setSelectedClassroomName(found.name);
  };

  const selectedCertStudent = useMemo(() => {
    return students.find((s) => s.id === selectedCertStudentId) || students[0];
  }, [students, selectedCertStudentId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-7xl h-[95vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 text-white font-bold overflow-hidden p-1 bg-white">
              {schoolHeader.schoolLogoDataUrl ? (
                <img
                  src={schoolHeader.schoolLogoDataUrl}
                  alt="ตราโรงเรียน"
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-amber-950 font-black text-xs">สพฐ.</span>
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                ศูนย์เอกสารวิชาการและสมุด ปพ. มาตรฐาน สพฐ.
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  รองรับทุกระดับชั้น (Universal OBEC)
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {schoolHeader.schoolName} | ปีการศึกษา {academicYear}
              </p>
            </div>
          </div>

          {/* Classroom Selector (สลับได้ทุกชั้นเรียน) */}
          <div className="flex items-center gap-2 bg-slate-800/90 px-3 py-1.5 rounded-2xl border border-slate-700 shadow-sm">
            <GraduationCap className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-slate-300 font-medium">ระดับชั้น/ห้องเรียน:</span>
            <select
              value={selectedClassroomId}
              onChange={(e) => handleClassroomChange(e.target.value)}
              className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer"
            >
              {classrooms.map((c) => (
                <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Navigation Bar */}
        <div className="border-b border-slate-800 px-4 sm:px-6 bg-slate-900 flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setDocCategory('pp6_individual')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 font-bold text-xs transition whitespace-nowrap ${
              docCategory === 'pp6_individual'
                ? 'border-blue-500 text-blue-400 bg-blue-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            สมุดรายงานประจำตัว ปพ.๖ (รายบุคคล)
          </button>

          <button
            onClick={() => setDocCategory('pp5_suite')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 font-bold text-xs transition whitespace-nowrap ${
              docCategory === 'pp5_suite'
                ? 'border-purple-500 text-purple-400 bg-purple-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            สมุด ปพ.๕ (สรุปรายชั้น & รายวิชา)
          </button>

          <button
            onClick={() => setDocCategory('certificates')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 font-bold text-xs transition whitespace-nowrap ${
              docCategory === 'certificates'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Award className="w-4 h-4" />
            หนังสือรับรองผลการเรียน (Transcript)
          </button>

          <button
            onClick={() => setDocCategory('settings')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 font-bold text-xs transition whitespace-nowrap ${
              docCategory === 'settings'
                ? 'border-amber-500 text-amber-400 bg-amber-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building2 className="w-4 h-4" />
            ตั้งค่าชื่อผู้บริหาร & โรงเรียน
          </button>
        </div>

        {/* Modal Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
              กำลังประมวลผลข้อมูลเอกสาร...
            </div>
          ) : (
            <>
              {/* 1. ปพ.๖ เล่มรายงานประจำตัวนักเรียน สพฐ. */}
              {docCategory === 'pp6_individual' && (
                <UniversalPhorPhor6Viewer
                  schoolHeader={schoolHeader}
                  gradeLevel={selectedClassroomName}
                  roomName="1"
                  academicYear={academicYear}
                  students={students}
                  studentReports={realPayload?.studentReports}
                />
              )}

              {/* 2. ปพ.๕ สมุดบันทึกผลการพัฒนาคุณภาพผู้เรียน */}
              {docCategory === 'pp5_suite' && (
                <UniversalPhorPhor5Viewer
                  schoolHeader={schoolHeader}
                  gradeLevel={selectedClassroomName}
                  roomName="1"
                  academicYear={academicYear}
                  students={students}
                  classSummaryScores={realPayload?.classSummaryScores}
                />
              )}

              {/* 3. หนังสือรับรองผลการเรียนทางการ (Transcript) */}
              {docCategory === 'certificates' && (
                <div className="max-w-4xl mx-auto space-y-6">
                  <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-base text-white">ออกหนังสือรับรองผลการเรียนทางการ</h4>
                      <p className="text-xs text-slate-400 mt-1">
                        พิมพ์หนังสือรับรองสถานภาพนักเรียน หรือใบแสดงผลการเรียนอย่างเป็นทางการ
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <select
                        value={selectedCertStudentId}
                        onChange={(e) => setSelectedCertStudentId(e.target.value)}
                        className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-bold focus:outline-none"
                      >
                        {students.map((st) => (
                          <option key={st.id} value={st.id}>
                            {st.prefix || ''}{st.first_name} {st.last_name} ({st.student_code})
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={async () => {
                          if (!certSheetRef.current) {
                            window.print();
                            return;
                          }
                          setIsPrintingCert(true);
                          await printElementAsDocument(certSheetRef.current, {
                            title: `หนังสือรับรอง_${selectedCertStudent?.first_name || 'นักเรียน'}_ปี${academicYear}`,
                            orientation: 'portrait',
                          });
                          setIsPrintingCert(false);
                        }}
                        disabled={isPrintingCert}
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg transition disabled:opacity-50"
                      >
                        <Printer className="w-4 h-4" />
                        <span>{isPrintingCert ? 'กำลังเตรียมพิมพ์...' : 'พิมพ์หนังสือรับรอง A4'}</span>
                      </button>
                    </div>
                  </div>

                  {/* พรีวิวหนังสือรับรอง A4 */}
                  <div ref={certSheetRef} className="bg-white text-slate-900 p-12 shadow-2xl rounded-sm border border-slate-300 font-serif max-w-[210mm] mx-auto min-h-[297mm]">
                    <div className="text-center mb-8">
                      <div className="flex justify-center mb-3">
                        {!schoolHeader.useGarudaInsteadOfLogo && schoolHeader.schoolLogoDataUrl ? (
                          <img
                            src={schoolHeader.schoolLogoDataUrl}
                            alt="ตราประจำโรงเรียน"
                            className="w-20 h-20 max-h-20 max-w-[120px] object-contain drop-shadow-sm"
                          />
                        ) : (
                          <svg
                            viewBox="0 0 200 220"
                            className="w-20 h-20 text-slate-900 fill-current drop-shadow-sm"
                            aria-label="ตราครุฑพ่าห์"
                          >
                            <path d="M100 15 C95 10 90 20 85 28 C80 35 70 38 65 35 C55 30 45 42 50 52 C55 60 48 70 40 75 C30 82 25 95 35 105 C42 112 40 120 32 128 C22 138 28 152 42 155 C52 157 58 168 55 178 C52 188 65 198 75 192 C82 188 90 195 92 205 C94 215 106 215 108 205 C110 195 118 188 125 192 C135 198 148 188 145 178 C142 168 148 157 158 155 C172 152 178 138 168 128 C160 120 158 112 165 105 C175 95 170 82 160 75 C152 70 145 60 150 52 C155 42 145 30 135 35 C130 38 120 35 115 28 C110 20 105 10 100 15 Z M95 45 C98 40 102 40 105 45 C108 55 92 55 95 45 Z M85 70 C85 62 115 62 115 70 C115 78 85 78 85 70 Z M75 95 C75 85 125 85 125 95 C125 105 75 105 75 95 Z M80 125 C80 115 120 115 120 125 C120 135 80 135 80 125 Z M90 155 C90 148 110 148 110 155 C110 162 90 162 90 155 Z" />
                          </svg>
                        )}
                      </div>
                      <h3 className="text-xl font-bold tracking-wider">หนังสือรับรอง</h3>
                      <p className="text-sm font-semibold">{schoolHeader.schoolName}</p>
                      <p className="text-xs text-slate-600 mt-1">ที่ {certNumber}</p>
                    </div>

                    <div className="text-sm leading-loose space-y-4 indent-8 text-justify">
                      <p>
                        หนังสือฉบับนี้ให้ไว้เพื่อรับรองว่า <span className="font-bold underline">{selectedCertStudent?.prefix || ''}{selectedCertStudent?.first_name} {selectedCertStudent?.last_name}</span> เลขประจำตัวนักเรียน <span className="font-bold">{selectedCertStudent?.student_code}</span> เกิดวันที่ <span className="font-bold">{selectedCertStudent?.birthdate || '21 กันยายน 2557'}</span> เป็นนักเรียนกำลังศึกษาอยู่ในระดับชั้น <span className="font-bold">{selectedClassroomName}</span> โรงเรียน{schoolHeader.schoolName} สังกัด{schoolHeader.jurisdiction} ในปีการศึกษา {academicYear} จริง
                      </p>
                      <p>
                        นักเรียนมีความประพฤติเรียบร้อย มีผลการเรียนเฉลี่ยสะสม (GPA) <span className="font-bold">3.50</span> และมีเวลาเรียนสม่ำเสมอครบถ้วนตามเกณฑ์ของกระทรวงศึกษาธิการ
                      </p>
                      <p>
                        ออกให้ ณ วันที่ {formatThaiOfficialDate(new Date())} {certPurpose}
                      </p>
                    </div>

                    <div className="mt-24 text-right pr-12 text-sm leading-relaxed">
                      <div className="inline-block text-center">
                        <div className="h-12"></div>
                        <p className="font-bold">({schoolHeader.directorName})</p>
                        <p className="text-slate-600">{schoolHeader.directorPosition}</p>
                        <p className="text-slate-600">{schoolHeader.schoolName}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. การตั้งค่าข้อมูลโรงเรียน ตราสัญลักษณ์ และผู้บริหาร */}
              {docCategory === 'settings' && (
                <div className="max-w-3xl mx-auto space-y-6">
                  {/* ซ่อน file input สำหรับอัปโหลดตราโรงเรียน */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => void handleLogoUpload(e)}
                    className="hidden"
                  />

                  {/* Header & Quick Navigation Bar */}
                  <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-3xl shadow-xl space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h4 className="font-bold text-base text-white flex items-center gap-2">
                          <Building2 className="w-5 h-5 text-amber-400" />
                          ข้อมูลโรงเรียนและผู้บริหารสำหรับเอกสาร ปพ.
                        </h4>
                        <p className="text-xs text-slate-400 mt-1">
                          ข้อมูลเหล่านี้จะปรากฏในช่องลงนาม 3 ฝ่าย และส่วนหัวของเล่ม ปพ.๕, ปพ.๖ และหนังสือรับรองทุกหน้า
                        </p>
                      </div>

                      {/* Quick Navigation Buttons */}
                      <div className="flex items-center gap-2 flex-wrap shrink-0">
                        <button
                          type="button"
                          onClick={() => void handleSyncFromWorkspace()}
                          disabled={isSyncing}
                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition disabled:opacity-50"
                          title="ดึงข้อมูลโรงเรียนและตราล่าสุดจากระบบ"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-amber-400' : ''}`} />
                          <span>{isSyncing ? 'กำลังซิงค์...' : 'ซิงค์จากระบบ'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleNavigateToWorkspaceSettings}
                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-bold rounded-xl border border-amber-500/30 transition"
                          title="ไปยังหน้าตั้งค่าโรงเรียนหลัก (Workspace Settings)"
                        >
                          <Settings2 className="w-3.5 h-3.5" />
                          <span>ไปตั้งค่าโรงเรียนหลัก</span>
                          <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />
                        </button>
                      </div>
                    </div>

                    {/* Notice / Feedback alert */}
                    {saveNotice && (
                      <div
                        className={`p-3 rounded-2xl text-xs font-medium flex items-center gap-2 border ${
                          saveNotice.type === 'success'
                            ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                            : saveNotice.type === 'error'
                            ? 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                            : 'bg-sky-950/60 border-sky-500/40 text-sky-300'
                        }`}
                      >
                        {saveNotice.type === 'success' ? (
                          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                        ) : saveNotice.type === 'error' ? (
                          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                        ) : (
                          <Sparkles className="w-4 h-4 shrink-0 text-sky-400" />
                        )}
                        <span>{saveNotice.text}</span>
                      </div>
                    )}
                  </div>

                  {/* Section 1: ตราสัญลักษณ์สถานศึกษา / โรงเรียน (School Logo / Emblem) */}
                  <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-3xl shadow-xl space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div>
                        <h5 className="font-bold text-sm text-white flex items-center gap-2">
                          <ImageIcon className="w-4 h-4 text-amber-400" />
                          ตราประจำโรงเรียน (School Emblem / Logo)
                        </h5>
                        <p className="text-xs text-slate-400 mt-0.5">
                          นำไปแสดงบนหน้าปกสมุด ปพ.๖, ปพ.๕ และหนังสือรับรองผลการเรียน (Transcript)
                        </p>
                      </div>
                      {identity.schoolLogoDataUrl && (
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          ✓ มีตราโรงเรียนแล้ว
                        </span>
                      )}
                    </div>

                    {identity.schoolLogoDataUrl ? (
                      <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-2xl bg-slate-850 border border-slate-800 bg-slate-950/50">
                        {/* กรอบพรีวิวตราโรงเรียนพื้นหลังขาว */}
                        <div className="w-24 h-24 rounded-2xl bg-white border-2 border-amber-500/30 p-2 shadow-xl flex items-center justify-center shrink-0">
                          <img
                            src={identity.schoolLogoDataUrl}
                            alt="ตราโรงเรียน"
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>

                        <div className="flex-1 space-y-2 text-center sm:text-left">
                          <p className="text-xs font-semibold text-slate-200">
                            ตรวจพบตราสัญลักษณ์โรงเรียนในระบบ (พร้อมใช้งานในรายงานและเอกสารทางการ)
                          </p>
                          <p className="text-[11px] text-slate-400">
                            ระบบซิงค์ตราโรงเรียนนี้เชื่อมโยงร่วมกับหน้า 'ตั้งค่าโรงเรียนหลัก' และรายงานอื่นๆ โดยอัตโนมัติ
                          </p>
                          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={logoUploading}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-700 transition"
                            >
                              <Upload className="w-3.5 h-3.5 text-amber-400" />
                              <span>{logoUploading ? 'กำลังอัปโหลด...' : 'เปลี่ยนรูปตราโรงเรียน'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={handleRemoveLogo}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold rounded-xl border border-rose-500/30 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>นำตราโรงเรียนออก</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-700 hover:border-amber-500/50 bg-slate-950/40 hover:bg-slate-950/80 p-6 rounded-2xl cursor-pointer text-center transition group space-y-2"
                      >
                        <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition">
                          <Upload className="w-6 h-6" />
                        </div>
                        <p className="text-xs font-bold text-white">
                          {logoUploading ? 'กำลังประมวลผลรูปภาพ...' : 'คลิกเพื่อแนบรูปภาพตราโรงเรียน (PNG, JPG, WebP)'}
                        </p>
                        <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                          ระบบจะปรับสเกลขนาดภาพอัตโนมัติเพื่อให้คมชัดบนเอกสาร ปพ. หากคุณครูเคยอัปโหลดไว้ในหน้า 'ตั้งค่าโรงเรียนหลัก' ให้กดปุ่ม "ซิงค์จากระบบ" ด้านบนเพื่อดึงมาได้ทันที
                        </p>
                      </div>
                    )}

                    {/* ตัวเลือกแสดงตราบนเอกสาร */}
                    <div className="pt-2 border-t border-slate-800/80">
                      <label className="text-xs text-slate-300 font-bold block mb-2">
                        รูปแบบตราสัญลักษณ์บนหน้าปกเอกสาร ปพ.:
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <label
                          className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition ${
                            !identity.useGarudaInsteadOfLogo
                              ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                              : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                          }`}
                        >
                          <input
                            type="radio"
                            name="logoMode"
                            checked={!identity.useGarudaInsteadOfLogo}
                            onChange={() => setIdentity({ ...identity, useGarudaInsteadOfLogo: false })}
                            className="text-amber-500 focus:ring-amber-500"
                          />
                          <span className="font-semibold">
                            ใช้ตราโรงเรียน (เมื่อมีตราโรงเรียน)
                          </span>
                        </label>

                        <label
                          className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition ${
                            identity.useGarudaInsteadOfLogo
                              ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                              : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                          }`}
                        >
                          <input
                            type="radio"
                            name="logoMode"
                            checked={Boolean(identity.useGarudaInsteadOfLogo)}
                            onChange={() => setIdentity({ ...identity, useGarudaInsteadOfLogo: true })}
                            className="text-amber-500 focus:ring-amber-500"
                          />
                          <span className="font-semibold">
                            ใช้ตราครุฑพ่าห์ สพฐ. มาตรฐานราชการ
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: ข้อมูลสถานศึกษาและสังกัด */}
                  <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-3xl shadow-xl space-y-4">
                    <h5 className="font-bold text-sm text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                      <GraduationCap className="w-4 h-4 text-amber-400" />
                      ข้อมูลสถานศึกษาและสังกัด
                    </h5>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-slate-400 mb-1 font-semibold">ชื่อโรงเรียน</label>
                        <input
                          type="text"
                          value={identity.schoolName || ''}
                          onChange={(e) => setIdentity({ ...identity, schoolName: e.target.value })}
                          placeholder="เช่น โรงเรียนบ้านหนองไฮ่ย"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1 font-semibold">สังกัด / สำนักงานเขตพื้นที่การศึกษา</label>
                        <input
                          type="text"
                          value={identity.jurisdiction || ''}
                          onChange={(e) => setIdentity({ ...identity, jurisdiction: e.target.value })}
                          placeholder="เช่น สำนักงานเขตพื้นที่การศึกษาประถมศึกษา ศรีสะเกษ เขต 3"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1 font-semibold">อำเภอ</label>
                        <input
                          type="text"
                          value={identity.district || ''}
                          onChange={(e) => setIdentity({ ...identity, district: e.target.value })}
                          placeholder="เช่น อ.ขุขันธ์"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1 font-semibold">จังหวัด</label>
                        <input
                          type="text"
                          value={identity.province || ''}
                          onChange={(e) => setIdentity({ ...identity, province: e.target.value })}
                          placeholder="เช่น จ.ศรีสะเกษ"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 3: รายนามผู้มีอำนาจลงนาม 3 ฝ่าย */}
                  <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-3xl shadow-xl space-y-4">
                    <h5 className="font-bold text-sm text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                      <UserCheck className="w-4 h-4 text-amber-400" />
                      รายนามผู้บริหารและผู้มีอำนาจลงนาม 3 ฝ่าย (เอกสาร ปพ.)
                    </h5>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-slate-400 mb-1 font-semibold">ชื่อผู้อำนวยการโรงเรียน</label>
                        <input
                          type="text"
                          value={identity.directorName || ''}
                          onChange={(e) => setIdentity({ ...identity, directorName: e.target.value })}
                          placeholder="เช่น นางสาวนิตยาภรณ์ ตรีแก้ว"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1 font-semibold">ตำแหน่งผู้บริหาร</label>
                        <input
                          type="text"
                          value={identity.directorPosition || 'ผู้อำนวยการสถานศึกษา'}
                          onChange={(e) => setIdentity({ ...identity, directorPosition: e.target.value })}
                          placeholder="เช่น ผู้อำนวยการสถานศึกษา"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1 font-semibold">ชื่อครูประจำชั้น / ครูที่ปรึกษา</label>
                        <input
                          type="text"
                          value={identity.teacherName || ''}
                          onChange={(e) => setIdentity({ ...identity, teacherName: e.target.value })}
                          placeholder="เช่น นายภูริณัฐ กุลัพบุรี"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1 font-semibold">ชื่อหัวหน้างานวิชาการ</label>
                        <input
                          type="text"
                          value={identity.academicHeadName || ''}
                          onChange={(e) => setIdentity({ ...identity, academicHeadName: e.target.value })}
                          placeholder="เช่น นางมุณี ทองแท้"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1 font-semibold">ชื่อนายทะเบียน</label>
                        <input
                          type="text"
                          value={identity.registrarName || ''}
                          onChange={(e) => setIdentity({ ...identity, registrarName: e.target.value })}
                          placeholder="เช่น นายภูริณัฐ กุลัพบุรี"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1 font-semibold">ชื่อครูประจำชั้นร่วม / ผู้ช่วย (ถ้ามี)</label>
                        <input
                          type="text"
                          value={identity.coAdvisorName || ''}
                          onChange={(e) => setIdentity({ ...identity, coAdvisorName: e.target.value })}
                          placeholder="ชื่อครูประจำชั้นร่วม (ถ้ามี)"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 4: Action Footer */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                    <p className="text-xs text-slate-400">
                      💡 เมื่อกดบันทึก ข้อมูลและตราโรงเรียนจะถูกจัดเก็บเข้าสู่ระบบเพื่อใช้กับเอกสาร ปพ.๕, ปพ.๖ และหนังสือรับรองโดยอัตโนมัติ
                    </p>

                    <button
                      type="button"
                      onClick={() => void handleSaveIdentity()}
                      disabled={isSaving}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition disabled:opacity-50 shrink-0"
                    >
                      <Save className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
                      <span>{isSaving ? 'กำลังบันทึกข้อมูล...' : 'บันทึกข้อมูล'}</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
};
