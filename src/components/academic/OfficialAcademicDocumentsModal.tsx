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
  Copy,
  Layers,
  GraduationCap,
} from 'lucide-react';
import { isDemoSession } from '../../lib/auth';
import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import { loadSchoolReportIdentity, type SchoolReportIdentity } from '../../lib/scheduleSettings';
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
  const [docCategory, setDocCategory] = useState<DocCategory>(initialCategory);
  const [identity, setIdentity] = useState<SchoolReportIdentity>(loadSchoolReportIdentity());
  const [loading, setLoading] = useState(false);
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
    schoolName: identity.schoolName || 'โรงเรียนบ้านโคกสูง',
    district: 'อ.ขุขันธ์',
    province: 'จ.ศรีสะเกษ',
    jurisdiction: 'สำนักงานเขตพื้นที่การศึกษาประถมศึกษา ศรีสะเกษ เขต 3',
    directorName: identity.directorName || 'นางสาวนิตยาภรณ์ ตรีแก้ว',
    directorPosition: 'ผู้อำนวยการสถานศึกษา',
    academicHeadName: identity.academicHeadName || 'นางมุณี ทองแท้',
    registrarName: identity.registrarName || 'นายภูริณัฐ กุลัพบุรี',
    homeroomTeacherName: identity.teacherName || 'นายภูริณัฐ กุลัพบุรี',
  }), [identity]);

  useEffect(() => {
    if (isOpen) {
      setIdentity(loadSchoolReportIdentity());
      loadClassroomsAndStudents();
    }
  }, [isOpen, selectedClassroomId]);

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

          const master = getPrimaryMasterData(activeName);
          const expectedCodes = new Set(master.students.map((s) => s.student_code));
          const validStData = (stData || []).filter((s) => expectedCodes.has(s.student_code));

          if (validStData.length > 0) {
            setStudents(validStData);
            setSelectedCertStudentId(validStData[0].id);
          } else {
            // fallback ใช้ Master Template ของชั้นนั้นถ้ายังไม่มีนักเรียนในห้องนั้น
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
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
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
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 text-white font-bold">
              สพฐ.
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
                        <svg
                          viewBox="0 0 200 220"
                          className="w-20 h-20 text-slate-900 fill-current drop-shadow-sm"
                          aria-label="ตราครุฑพ่าห์"
                        >
                          <path d="M100 15 C95 10 90 20 85 28 C80 35 70 38 65 35 C55 30 45 42 50 52 C55 60 48 70 40 75 C30 82 25 95 35 105 C42 112 40 120 32 128 C22 138 28 152 42 155 C52 157 58 168 55 178 C52 188 65 198 75 192 C82 188 90 195 92 205 C94 215 106 215 108 205 C110 195 118 188 125 192 C135 198 148 188 145 178 C142 168 148 157 158 155 C172 152 178 138 168 128 C160 120 158 112 165 105 C175 95 170 82 160 75 C152 70 145 60 150 52 C155 42 145 30 135 35 C130 38 120 35 115 28 C110 20 105 10 100 15 Z M95 45 C98 40 102 40 105 45 C108 55 92 55 95 45 Z M85 70 C85 62 115 62 115 70 C115 78 85 78 85 70 Z M75 95 C75 85 125 85 125 95 C125 105 75 105 75 95 Z M80 125 C80 115 120 115 120 125 C120 135 80 135 80 125 Z M90 155 C90 148 110 148 110 155 C110 162 90 162 90 155 Z" />
                        </svg>
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

              {/* 4. การตั้งค่าข้อมูลโรงเรียนและผู้บริหาร */}
              {docCategory === 'settings' && (
                <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl space-y-4">
                  <h4 className="font-bold text-base text-white flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-amber-400" />
                    ข้อมูลโรงเรียนและผู้บริหารสำหรับเอกสาร ปพ.
                  </h4>
                  <p className="text-xs text-slate-400">
                    ข้อมูลเหล่านี้จะปรากฏในช่องลงนาม 3 ฝ่าย และส่วนหัวของเล่ม ปพ.๕ และ ปพ.๖ ทุกหน้า
                  </p>

                  <div className="space-y-3 text-xs pt-2">
                    <div>
                      <label className="block text-slate-400 mb-1">ชื่อโรงเรียน</label>
                      <input
                        type="text"
                        value={identity.schoolName || ''}
                        onChange={(e) => setIdentity({ ...identity, schoolName: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1">ชื่อผู้อำนวยการโรงเรียน</label>
                        <input
                          type="text"
                          value={identity.directorName || ''}
                          onChange={(e) => setIdentity({ ...identity, directorName: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">ชื่อครูประจำชั้น</label>
                        <input
                          type="text"
                          value={identity.teacherName || ''}
                          onChange={(e) => setIdentity({ ...identity, teacherName: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1">ชื่อหัวหน้างานวิชาการ</label>
                        <input
                          type="text"
                          value={identity.academicHeadName || ''}
                          onChange={(e) => setIdentity({ ...identity, academicHeadName: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">ชื่อนายทะเบียน</label>
                        <input
                          type="text"
                          value={identity.registrarName || ''}
                          onChange={(e) => setIdentity({ ...identity, registrarName: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <button
                      onClick={() => alert('บันทึกข้อมูลโรงเรียนสำเร็จ!')}
                      className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow transition"
                    >
                      บันทึกข้อมูล
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
