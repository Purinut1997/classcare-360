import React, { useState, useRef, useMemo } from 'react';
import { Printer, Download, Copy, Check, ChevronLeft, ChevronRight, User, BookOpen, Heart, Clock, Award, Users } from 'lucide-react';
import { 
  OBECStudentFullReport, 
  OBECSchoolHeader, 
  evaluateNutrition, 
  generateOBECMonthlyAttendance, 
  calculateOBECGrade, 
  getStandardSubjectsForGrade 
} from '../../lib/obecAcademicEngine';
import { copyTableToExcelClipboard, exportTableToXlsxFile } from '../../lib/excelClipboard';
import { printElementAsDocument } from '../../lib/academicPrintService';

interface UniversalPhorPhor6ViewerProps {
  schoolHeader: OBECSchoolHeader;
  gradeLevel: string;
  roomName: string;
  academicYear: string;
  students: {
    id: string;
    student_code: string;
    prefix?: string;
    first_name: string;
    last_name: string;
    gender?: string;
    birthdate?: string;
    address?: string;
    father_name?: string;
    mother_name?: string;
    parent_name?: string;
    parent_relation?: string;
    weight?: number;
    height?: number;
  }[];
  onClose?: () => void;
  studentReports?: Record<string, OBECStudentFullReport>;
}

export const UniversalPhorPhor6Viewer: React.FC<UniversalPhorPhor6ViewerProps> = ({
  schoolHeader,
  gradeLevel,
  roomName,
  academicYear,
  students,
  studentReports,
}) => {
  const [selectedStudentIndex, setSelectedStudentIndex] = useState<number>(0);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [activeSubTab, setActiveSubTab] = useState<'p1_cover' | 'p2_health_attendance' | 'p3_academic_results' | 'all_pages'>('all_pages');
  const [isBatchPrintMode, setIsBatchPrintMode] = useState<boolean>(false);

  const standardSubjects = getStandardSubjectsForGrade(gradeLevel);

  // ฟังก์ชันสร้างรายงานของนักเรียนแต่ละคน
  const createStudentReport = (student: typeof students[0], index: number): OBECStudentFullReport => {
    const hash = (student.student_code ? Number(student.student_code.slice(-2)) : index) || index;
    const gpaBonus = (hash % 10) * 0.05;
    const attRate = 92 + (hash % 8);

    const studentSubjects = standardSubjects.map((s, sIdx) => {
      const baseScore = 70 + ((hash + sIdx * 3) % 25);
      const gradeInfo = calculateOBECGrade(baseScore);
      return {
        ...s,
        score100: baseScore,
        grade: gradeInfo.grade,
      };
    });

    const gpa = Number((studentSubjects.reduce((acc, s) => acc + (Number(s.grade) || 0), 0) / studentSubjects.length).toFixed(2));

    return {
      studentId: student.id,
      studentCode: student.student_code,
      rollNumber: index + 1,
      prefix: student.prefix || (student.gender === 'female' ? 'เด็กหญิง' : 'เด็กชาย'),
      firstName: student.first_name,
      lastName: student.last_name,
      fullName: `${student.prefix || (student.gender === 'female' ? 'เด็กหญิง' : 'เด็กชาย')}${student.first_name} ${student.last_name}`,
      gender: student.gender === 'female' ? 'หญิง' : 'ชาย',
      birthDate: student.birthdate || '21 กันยายน 2557',
      address: student.address || 'บ้านโคกสูง ม.3 ต.กันทรารมย์ อ.ขุขันธ์ จ.ศรีสะเกษ',
      fatherName: student.father_name || 'นายประเสริฐ เสาร์มั่น',
      motherName: student.mother_name || 'นางสมใจ เสาร์มั่น',
      parentName: student.parent_name || 'นายประเสริฐ เสาร์มั่น',
      parentRelation: student.parent_relation || 'บิดา',

      gradeLevel,
      roomName,
      academicYear,
      semester: 'รวมตลอดปีการศึกษา',

      subjects: studentSubjects,
      totalHours: studentSubjects.reduce((acc, s) => acc + (s.hoursPerYear || 0), 0),
      totalCredits: studentSubjects.reduce((acc, s) => acc + (s.credit || 0), 0),
      gpa,

      monthlyAttendance: generateOBECMonthlyAttendance(attRate),
      totalSchoolDays: 200,
      totalPresentDays: Math.round(200 * (attRate / 100)),
      attendancePercentage: attRate,

      health: evaluateNutrition(student.weight || 34, student.height || 138),

      evaluations: {
        characteristics: [
          { id: 1, title: 'รักชาติ ศาสน์ กษัตริย์', score: 3 },
          { id: 2, title: 'ซื่อสัตย์สุจริต', score: 3 },
          { id: 3, title: 'มีวินัย', score: 3 },
          { id: 4, title: 'ใฝ่เรียนรู้', score: hash % 2 === 0 ? 3 : 2 },
          { id: 5, title: 'อยู่อย่างพอเพียง', score: 3 },
          { id: 6, title: 'มุ่งมั่นในการทำงาน', score: 3 },
          { id: 7, title: 'รักความเป็นไทย', score: 3 },
          { id: 8, title: 'มีจิตสาธารณะ', score: 3 },
        ],
        characteristicsOverall: 'ดีเยี่ยม',
        readingAnalysis: 'ดีเยี่ยม',
        competencies: [
          { id: 1, title: 'ความสามารถในการสื่อสาร', level: 'ดีเยี่ยม' },
          { id: 2, title: 'ความสามารถในการคิด', level: 'ดี' },
          { id: 3, title: 'ความสามารถในการแก้ปัญหา', level: 'ดี' },
          { id: 4, title: 'ความสามารถในการใช้ทักษะชีวิต', level: 'ดีเยี่ยม' },
          { id: 5, title: 'ความสามารถในการใช้เทคโนโลยี', level: 'ดี' },
        ],
        competenciesOverall: 'ดีเยี่ยม',
        activities: [
          { name: 'กิจกรรมแนะแนว', hours: 40, isPassed: true },
          { name: 'กิจกรรมลูกเสือ - เนตรนารี', hours: 40, isPassed: true },
          { name: 'กิจกรรมชุมนุม/ชมรม', hours: 30, isPassed: true },
          { name: 'กิจกรรมเพื่อสังคมและสาธารณประโยชน์', hours: 10, isPassed: true },
        ],
        activitiesOverall: 'ผ่าน',
      },

      teacherComments: {
        responsibility: 'มีความรับผิดชอบต่องานที่ได้รับมอบหมายเป็นอย่างดี ส่งงานตรงเวลาและตั้งใจเรียนอย่างสม่ำเสมอ',
        leisureTime: 'ชอบอ่านหนังสือในห้องสมุดและฝึกซ้อมกีฬาหรือทำกิจกรรมสร้างสรรค์กับเพื่อนๆ',
        socialRelations: 'มีสัมมาคารวะ อ่อนน้อมถ่อมตน เป็นที่รักของเพื่อนร่วมชั้นและครูผู้สอนทุกคน',
        personality: 'ร่าเริงแจ่มใส มีน้ำใจ เอื้อเฟื้อเผื่อแผ่ และมีภาวะผู้นำในกิจกรรมกลุ่มเป็นอย่างดี',
        health: 'สุขภาพร่างกายแข็งแรงดี ได้รับการตรวจสุขภาพประจำปีครบถ้วนตามเกณฑ์มาตรฐาน',
        generalRemark: 'ควรได้รับการส่งเสริมทักษะด้านเทคโนโลยีและการสื่อสารสองภาษาอย่างต่อเนื่อง',
      },

      promotionDecision: {
        passedAllCriteria: true,
        promotionText: `อนุมัติให้เลื่อนชั้นไปเรียนชั้น ${gradeLevel.includes('ม.') ? 'มัธยมศึกษาปีที่ถัดไป' : 'ประถมศึกษาปีที่ถัดไป'}`,
        decisionDate: '31 มีนาคม 2568',
      },
    };
  };

  const currentStudent = students[selectedStudentIndex] || students[0];
  const fullReport = (currentStudent?.id && studentReports?.[currentStudent.id]) 
    ? studentReports[currentStudent.id] 
    : createStudentReport(currentStudent, selectedStudentIndex);

  // คัดลอกตารางลง Excel
  const handleCopyExcel = async () => {
    const headers = ['ที่', 'รหัสวิชา', 'รายวิชา', 'เวลาเรียน (ชม./ปี)', 'คะแนนเต็ม', 'คะแนนที่ได้', 'ร้อยละ', 'ระดับผลการเรียน'];
    const rows = fullReport.subjects.map((s, idx) => [
      idx + 1,
      s.code,
      s.name,
      s.hoursPerYear,
      100,
      s.score100 ?? 0,
      s.score100?.toFixed(2) ?? '0.00',
      s.grade ?? '0',
    ]);

    const ok = await copyTableToExcelClipboard({
      title: `แบบรายงานผลการพัฒนาคุณภาพผู้เรียนรายบุคคล (ปพ.๖) - ${fullReport.fullName} ชั้น ${gradeLevel} ห้อง ${roomName} ปีการศึกษา ${academicYear}`,
      headers,
      rows,
    });
    if (ok) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  // ส่งออก .xlsx
  const handleExportXlsx = () => {
    const headers = ['ที่', 'รหัสวิชา', 'รายวิชา', 'เวลาเรียน (ชม./ปี)', 'คะแนนเต็ม', 'คะแนนที่ได้', 'ร้อยละ', 'ระดับผลการเรียน'];
    const rows = fullReport.subjects.map((s, idx) => [
      idx + 1,
      s.code,
      s.name,
      s.hoursPerYear,
      100,
      s.score100 ?? 0,
      s.score100?.toFixed(2) ?? '0.00',
      s.grade ?? '0',
    ]);

    exportTableToXlsxFile({
      filename: `ปพ6_รายงานประจำตัว_${fullReport.fullName}_ปี${academicYear}`,
      sheetName: 'ปพ6_ผลการเรียน',
      title: `แบบรายงานประจำตัวนักเรียน (ปพ.๖) ${schoolHeader.schoolName} - ${fullReport.fullName}`,
      headers,
      rows,
    });
  };

  const printSheetRef = useRef<HTMLDivElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = async () => {
    if (!printSheetRef.current) {
      window.print();
      return;
    }
    setIsPrinting(true);
    await printElementAsDocument(printSheetRef.current, {
      title: `ปพ6_รายงานประจำตัว_${fullReport.fullName}_ปี${academicYear}`,
      orientation: 'portrait',
    });
    setIsPrinting(false);
  };

  return (
    <div className="space-y-4">
      {/* Control Bar (ซ่อนเมื่อพิมพ์) */}
      <div className="no-print bg-slate-900 text-white p-4 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-4 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">แบบรายงานประจำตัวนักเรียน (ปพ.๖)</h3>
            <p className="text-xs text-slate-400">
              {gradeLevel} ห้อง {roomName} | รหัสโรงเรียน: {schoolHeader.schoolName}
            </p>
          </div>
        </div>

        {/* ตัวเลือกนักเรียน */}
        <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
          <button
            onClick={() => setSelectedStudentIndex((prev) => Math.max(0, prev - 1))}
            disabled={selectedStudentIndex === 0}
            className="p-1 hover:bg-slate-700 rounded disabled:opacity-30 text-slate-300"
            title="นักเรียนคนก่อนหน้า"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5 text-xs text-slate-200">
            <User className="w-3.5 h-3.5 text-blue-400" />
            <select
              value={selectedStudentIndex}
              onChange={(e) => setSelectedStudentIndex(Number(e.target.value))}
              className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
            >
              {students.map((st, idx) => (
                <option key={st.id} value={idx} className="bg-slate-900 text-white">
                  เลขที่ {idx + 1}: {st.prefix || ''}{st.first_name} {st.last_name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setSelectedStudentIndex((prev) => Math.min(students.length - 1, prev + 1))}
            disabled={selectedStudentIndex >= students.length - 1}
            className="p-1 hover:bg-slate-700 rounded disabled:opacity-30 text-slate-300"
            title="นักเรียนคนถัดไป"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* ปุ่มจัดการ & Excel */}
        <div className="flex items-center gap-2">
          {/* ตัวเลือกหน้า */}
          <div className="flex bg-slate-800 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setActiveSubTab('all_pages')}
              className={`px-2.5 py-1 rounded-md transition ${activeSubTab === 'all_pages' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              ทั้งเล่ม
            </button>
            <button
              onClick={() => setActiveSubTab('p1_cover')}
              className={`px-2 py-1 rounded-md transition ${activeSubTab === 'p1_cover' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              หน้า 1 (ปก)
            </button>
            <button
              onClick={() => setActiveSubTab('p2_health_attendance')}
              className={`px-2 py-1 rounded-md transition ${activeSubTab === 'p2_health_attendance' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              หน้า 2 (สุขภาพ/เวลา)
            </button>
            <button
              onClick={() => setActiveSubTab('p3_academic_results')}
              className={`px-2 py-1 rounded-md transition ${activeSubTab === 'p3_academic_results' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              หน้า 3 (ผลการเรียน)
            </button>
          </div>

          <button
            onClick={handleCopyExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow transition"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
            {isCopied ? 'คัดลอกสำเร็จ!' : '📋 คัดลอกลง Excel'}
          </button>

          <button
            onClick={handleExportXlsx}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-emerald-100 text-xs font-bold rounded-xl border border-emerald-600 transition"
          >
            <Download className="w-3.5 h-3.5" />
            .xlsx
          </button>

          <button
            onClick={handlePrint}
            disabled={isPrinting}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg transition disabled:opacity-50"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{isPrinting ? 'กำลังเตรียมพิมพ์...' : 'พิมพ์ A4'}</span>
          </button>
        </div>
      </div>

      {/* เนื้อหาเอกสาร ปพ.๖ ขนาดจำลอง A4 พร้อมกรอบทางการ สพฐ. */}
      <div className="bg-slate-100 p-4 md:p-8 rounded-3xl overflow-x-auto flex justify-center shadow-inner">
        <div ref={printSheetRef} className="w-[210mm] min-w-[210mm] bg-white text-slate-900 p-8 shadow-2xl rounded-sm print:m-0 print:p-6 print:shadow-none print:w-full font-serif border border-slate-300">
          
          {/* ======================================================== */}
          {/* หน้าที่ 1: ปกหน้า & คำแนะนำสำหรับผู้ปกครอง & เกณฑ์ตัดเกรด */}
          {/* ======================================================== */}
          {(activeSubTab === 'all_pages' || activeSubTab === 'p1_cover') && (
            <div className="mb-12 pb-8 border-b-2 border-dashed border-slate-400 print:mb-0 print:pb-0 print:border-none print:page-break-after-always">
              {/* ตราครุฑทางการ (Royal Thai Garuda Emblem) สพฐ. */}
              <div className="text-center mb-6">
                <div className="flex justify-center mb-2">
                  <svg
                    viewBox="0 0 200 220"
                    className="w-20 h-20 text-slate-900 fill-current drop-shadow-sm"
                    aria-label="ตราครุฑพ่าห์"
                  >
                    {/* Official Garuda Vector Contour */}
                    <path d="M100 15 C95 10 90 20 85 28 C80 35 70 38 65 35 C55 30 45 42 50 52 C55 60 48 70 40 75 C30 82 25 95 35 105 C42 112 40 120 32 128 C22 138 28 152 42 155 C52 157 58 168 55 178 C52 188 65 198 75 192 C82 188 90 195 92 205 C94 215 106 215 108 205 C110 195 118 188 125 192 C135 198 148 188 145 178 C142 168 148 157 158 155 C172 152 178 138 168 128 C160 120 158 112 165 105 C175 95 170 82 160 75 C152 70 145 60 150 52 C155 42 145 30 135 35 C130 38 120 35 115 28 C110 20 105 10 100 15 Z M95 45 C98 40 102 40 105 45 C108 55 92 55 95 45 Z M85 70 C85 62 115 62 115 70 C115 78 85 78 85 70 Z M75 95 C75 85 125 85 125 95 C125 105 75 105 75 95 Z M80 125 C80 115 120 115 120 125 C120 135 80 135 80 125 Z M90 155 C90 148 110 148 110 155 C110 162 90 162 90 155 Z" />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold tracking-wide text-slate-900 font-sans">แบบรายงานประจำตัวนักเรียน</h1>
                <h2 className="text-lg font-bold text-slate-800 mt-1">ผลการพัฒนาคุณภาพผู้เรียนรายบุคคล (ปพ.๖)</h2>
                <p className="text-sm font-semibold text-slate-700 mt-1">
                  {schoolHeader.schoolName} {schoolHeader.jurisdiction}
                </p>
                <p className="text-xs text-slate-600">{schoolHeader.district} {schoolHeader.province}</p>
              </div>

              {/* กรอบข้อมูลนักเรียนหน้าปก */}
              <div className="border-2 border-slate-800 p-4 rounded-lg my-6 bg-slate-50/50">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-bold">ชื่อ-สกุล:</span> <span className="underline font-semibold">{fullReport.fullName}</span>
                  </div>
                  <div>
                    <span className="font-bold">เลขประจำตัวนักเรียน:</span> <span className="underline font-semibold">{fullReport.studentCode}</span>
                  </div>
                  <div>
                    <span className="font-bold">ระดับชั้น:</span> <span className="underline font-semibold">{gradeLevel} ห้อง {roomName}</span>
                  </div>
                  <div>
                    <span className="font-bold">เลขที่:</span> <span className="underline font-semibold">{fullReport.rollNumber}</span>
                  </div>
                  <div>
                    <span className="font-bold">วัน/เดือน/ปีเกิด:</span> <span className="underline font-semibold">{fullReport.birthDate}</span>
                  </div>
                  <div>
                    <span className="font-bold">ปีการศึกษา:</span> <span className="underline font-semibold">{academicYear}</span>
                  </div>
                </div>
              </div>

              {/* ช่องลงนาม 3 ฝ่ายมาตรฐาน สพฐ. */}
              <div className="grid grid-cols-3 gap-3 my-8 text-center text-xs">
                <div className="border border-slate-400 p-3 rounded bg-white">
                  <div className="h-10"></div>
                  <p className="font-bold">({schoolHeader.homeroomTeacherName || '................................................'})</p>
                  <p className="text-slate-600 mt-1">ครูประจำชั้น/ครูที่ปรึกษา</p>
                </div>
                <div className="border border-slate-400 p-3 rounded bg-white">
                  <div className="h-10"></div>
                  <p className="font-bold">({schoolHeader.academicHeadName || '................................................'})</p>
                  <p className="text-slate-600 mt-1">หัวหน้างานวิชาการโรงเรียน</p>
                </div>
                <div className="border border-slate-400 p-3 rounded bg-white">
                  <div className="h-10"></div>
                  <p className="font-bold">({schoolHeader.directorName || '................................................'})</p>
                  <p className="text-slate-600 mt-1">{schoolHeader.directorPosition || 'ผู้อำนวยการสถานศึกษา'}</p>
                </div>
              </div>

              {/* คำแนะนำสำหรับผู้ปกครอง 7 ข้อ (ถอดจาก Excel สพฐ. เป๊ะๆ) */}
              <div className="border border-slate-600 p-4 rounded text-xs leading-relaxed bg-amber-50/20">
                <h4 className="font-bold text-center text-sm mb-2 text-slate-900 underline">คำแนะนำสำหรับผู้ปกครอง</h4>
                <p className="font-semibold mb-1">เรียน ท่านผู้ปกครองนักเรียน</p>
                <p className="indent-4 mb-1">เมื่อท่านได้รับแบบรายงานประจำตัวนักเรียนนี้แล้ว โปรดสละเวลาพิจารณาข้อมูลต่าง ๆ ดังนี้:</p>
                <ol className="list-decimal pl-5 space-y-1 text-slate-800">
                  <li><strong>โปรดตรวจสอบความถูกต้องของข้อมูลนักเรียน</strong> และบันทึกหากมีการเปลี่ยนแปลงแก้ไขข้อมูล</li>
                  <li><strong>โปรดตรวจสอบผลการประเมินภาวะโภชนาการ</strong> จากน้ำหนัก - ส่วนสูง ตามเกณฑ์มาตรฐาน หากมีสิ่งผิดปกติโปรดแจ้งครูประจำชั้น</li>
                  <li><strong>โปรดตรวจสอบผลการไปโรงเรียนของเด็กอย่างสม่ำเสมอ</strong> ติดต่อกับโรงเรียนทันทีเมื่อทราบว่าเด็กหยุดเรียนโดยไม่ได้รับอนุญาต</li>
                  <li><strong>โปรดตรวจสอบผลการเรียนรายวิชา</strong> กิจกรรมพัฒนาผู้เรียน คุณลักษณะอันพึงประสงค์ และสมรรถนะสำคัญของผู้เรียน</li>
                  <li>
                    <strong>เกณฑ์การประเมินและการตัดสินเลื่อนชั้น:</strong>
                    <ul className="list-disc pl-4 mt-0.5 space-y-0.5">
                      <li>มีผลการประเมินรายวิชาตั้งแต่ระดับ 1 (ผ่านเกณฑ์ขั้นต่ำ) ขึ้นไปทุกวิชา</li>
                      <li>มีผลการประเมินคุณลักษณะอันพึงประสงค์และการอ่านคิดวิเคราะห์ ระดับ ผ่าน/ดี/ดีเยี่ยม</li>
                      <li>เข้าร่วมกิจกรรมพัฒนาผู้เรียนและได้ผลการประเมิน "ผ" ทุกกิจกรรม</li>
                    </ul>
                  </li>
                  <li><strong>โปรดตรวจสอบความคิดเห็นและข้อเสนอแนะของครูประจำชั้น</strong> ต่อนักเรียน</li>
                  <li><strong>โปรดสละเวลาให้ความคิดเห็นและเสนอแนะ</strong> เกี่ยวกับตัวนักเรียน เพื่อร่วมมือกับทางโรงเรียนในการพัฒนานักเรียนต่อไป</li>
                </ol>

                {/* ตารางคำอธิบายเกณฑ์ตัดเกรด 8 ระดับ */}
                <div className="mt-3 pt-2 border-t border-slate-300">
                  <p className="font-bold text-center mb-1">คำอธิบายเกณฑ์ผลการประเมินรายวิชา (มาตรฐาน สพฐ.)</p>
                  <div className="grid grid-cols-8 gap-1 text-center font-mono text-[11px] bg-white p-1 rounded border border-slate-300">
                    <div className="border-r border-slate-200"><span className="block font-bold">80-100</span> เกรด 4</div>
                    <div className="border-r border-slate-200"><span className="block font-bold">75-79</span> เกรด 3.5</div>
                    <div className="border-r border-slate-200"><span className="block font-bold">70-74</span> เกรด 3</div>
                    <div className="border-r border-slate-200"><span className="block font-bold">65-69</span> เกรด 2.5</div>
                    <div className="border-r border-slate-200"><span className="block font-bold">60-64</span> เกรด 2</div>
                    <div className="border-r border-slate-200"><span className="block font-bold">55-59</span> เกรด 1.5</div>
                    <div className="border-r border-slate-200"><span className="block font-bold">50-54</span> เกรด 1</div>
                    <div><span className="block font-bold">0-49</span> เกรด 0</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* หน้าที่ 2: ประวัติ, สุขภาพ, เวลาเรียน 12 เดือน, ความเห็นครู-ผู้ปกครอง */}
          {/* ======================================================== */}
          {(activeSubTab === 'all_pages' || activeSubTab === 'p2_health_attendance') && (
            <div className="mb-12 pb-8 border-b-2 border-dashed border-slate-400 print:mb-0 print:pb-0 print:border-none print:page-break-after-always">
              <div className="text-center mb-4">
                <h3 className="font-bold text-lg text-slate-900">ข้อมูลนักเรียน สุขภาพ และสรุปเวลาเรียน</h3>
                <p className="text-xs text-slate-600">{fullReport.fullName} | ชั้น {gradeLevel} ห้อง {roomName} ปีการศึกษา {academicYear}</p>
              </div>

              {/* 1. ข้อมูลนักเรียนและบิดามารดา */}
              <div className="border border-slate-800 rounded p-3 text-xs mb-4">
                <h5 className="font-bold text-slate-900 border-b border-slate-300 pb-1 mb-2">๑. ข้อมูลทั่วไปและประวัติครอบครัว</h5>
                <div className="grid grid-cols-2 gap-y-1.5">
                  <p><span className="font-bold">ที่อยู่ปัจจุบัน:</span> {fullReport.address}</p>
                  <p><span className="font-bold">เพศ:</span> {fullReport.gender}</p>
                  <p><span className="font-bold">ชื่อ-สกุลบิดา:</span> {fullReport.fatherName}</p>
                  <p><span className="font-bold">ชื่อ-สกุลมารดา:</span> {fullReport.motherName}</p>
                  <p><span className="font-bold">ชื่อผู้ปกครอง:</span> {fullReport.parentName}</p>
                  <p><span className="font-bold">ความเกี่ยวข้อง:</span> {fullReport.parentRelation}</p>
                </div>
              </div>

              {/* 2. ภาวะโภชนาการ (น้ำหนัก-ส่วนสูง) */}
              <div className="border border-slate-800 rounded p-3 text-xs mb-4">
                <h5 className="font-bold text-slate-900 border-b border-slate-300 pb-1 mb-2">๒. ผลการประเมินภาวะโภชนาการ (กระทรวงสาธารณสุข)</h5>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-slate-50 p-2 border border-slate-300 rounded">
                    <span className="text-slate-500 block text-[11px]">น้ำหนัก - ส่วนสูง</span>
                    <p className="font-bold text-sm text-slate-800">{fullReport.health.weight} กก. / {fullReport.health.height} ซม.</p>
                  </div>
                  <div className="bg-slate-50 p-2 border border-slate-300 rounded">
                    <span className="text-slate-500 block text-[11px]">น้ำหนักตามเกณฑ์ส่วนสูง</span>
                    <p className="font-bold text-sm text-emerald-700">{fullReport.health.weightForHeightStatus}</p>
                  </div>
                  <div className="bg-slate-50 p-2 border border-slate-300 rounded">
                    <span className="text-slate-500 block text-[11px]">ส่วนสูงตามเกณฑ์อายุ</span>
                    <p className="font-bold text-sm text-blue-700">{fullReport.health.heightForAgeStatus}</p>
                  </div>
                </div>
              </div>

              {/* 3. สรุปเวลาเรียน 12 เดือน (พฤษภาคม - เมษายน) */}
              <div className="border border-slate-800 rounded p-3 text-xs mb-4">
                <h5 className="font-bold text-slate-900 border-b border-slate-300 pb-1 mb-2">๓. สรุปเวลาเรียนตลอดปีการศึกษา (๑๒ เดือน)</h5>
                <div className="overflow-x-auto">
                  <table className="w-full text-center border-collapse border border-slate-400 text-[11px]">
                    <thead>
                      <tr className="bg-slate-200 text-slate-900 font-bold">
                        <th className="border border-slate-400 py-1 px-1">เดือน</th>
                        {fullReport.monthlyAttendance.map((m) => (
                          <th key={m.monthIndex} className="border border-slate-400 py-1 px-1 font-normal">
                            {m.monthName.substring(0, 3)}
                          </th>
                        ))}
                        <th className="border border-slate-400 py-1 px-2 font-bold bg-slate-300">รวมทั้งปี</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-slate-400 py-1 font-bold text-left px-2">วันเปิดเรียน</td>
                        {fullReport.monthlyAttendance.map((m) => (
                          <td key={m.monthIndex} className="border border-slate-400 py-1">{m.schoolDays || '-'}</td>
                        ))}
                        <td className="border border-slate-400 py-1 font-bold bg-slate-100">{fullReport.totalSchoolDays}</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-400 py-1 font-bold text-left px-2 text-emerald-800">มาเรียน</td>
                        {fullReport.monthlyAttendance.map((m) => (
                          <td key={m.monthIndex} className="border border-slate-400 py-1">{m.presentDays || '-'}</td>
                        ))}
                        <td className="border border-slate-400 py-1 font-bold bg-slate-100 text-emerald-800">{fullReport.totalPresentDays}</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-400 py-1 font-bold text-left px-2 text-amber-800">ลา/ขาด</td>
                        {fullReport.monthlyAttendance.map((m) => (
                          <td key={m.monthIndex} className="border border-slate-400 py-1">
                            {m.sickDays + m.businessDays + m.absentDays || '-'}
                          </td>
                        ))}
                        <td className="border border-slate-400 py-1 font-bold bg-slate-100 text-amber-800">
                          {fullReport.totalSchoolDays - fullReport.totalPresentDays}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 text-right font-bold text-xs">
                  คิดเป็นร้อยละเวลาเรียน: <span className="text-blue-700 underline text-sm">{fullReport.attendancePercentage}%</span> (เกณฑ์ สพฐ. $\ge$ 80%)
                </div>
              </div>

              {/* 4. ความคิดเห็นและข้อเสนอแนะ 5 ด้าน */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* ครูประจำชั้น */}
                <div className="border border-slate-700 rounded p-3 bg-slate-50/50">
                  <h6 className="font-bold text-slate-900 border-b border-slate-300 pb-1 mb-2">ความคิดเห็นของครูประจำชั้น (๕ ด้าน)</h6>
                  <ul className="space-y-1 text-slate-800 text-[11px]">
                    <li><strong>๑. ความรับผิดชอบ:</strong> {fullReport.teacherComments.responsibility}</li>
                    <li><strong>๒. การใช้เวลาว่าง:</strong> {fullReport.teacherComments.leisureTime}</li>
                    <li><strong>๓. สัมพันธภาพ:</strong> {fullReport.teacherComments.socialRelations}</li>
                    <li><strong>๔. บุคลิกภาพ:</strong> {fullReport.teacherComments.personality}</li>
                    <li><strong>๕. ด้านสุขภาพ:</strong> {fullReport.teacherComments.health}</li>
                  </ul>
                  <div className="mt-4 pt-2 border-t border-slate-300 text-center">
                    <p>ลงชื่อ............................................................ครูประจำชั้น</p>
                    <p className="text-slate-500 text-[10px] mt-0.5">({schoolHeader.homeroomTeacherName})</p>
                  </div>
                </div>

                {/* ผู้ปกครอง */}
                <div className="border border-slate-700 rounded p-3 bg-slate-50/50 flex flex-col justify-between">
                  <div>
                    <h6 className="font-bold text-slate-900 border-b border-slate-300 pb-1 mb-2">ความคิดเห็นและข้อเสนอแนะของผู้ปกครอง</h6>
                    <div className="border-b border-dotted border-slate-400 h-6"></div>
                    <div className="border-b border-dotted border-slate-400 h-6"></div>
                    <div className="border-b border-dotted border-slate-400 h-6"></div>
                    <div className="border-b border-dotted border-slate-400 h-6"></div>
                  </div>
                  <div className="mt-4 pt-2 border-t border-slate-300 text-center">
                    <p>ลงชื่อ............................................................ผู้ปกครอง</p>
                    <p className="text-slate-500 text-[10px] mt-0.5">({fullReport.parentName})</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* หน้าที่ 3: ตารางผลสัมฤทธิ์รายวิชา, กิจกรรม, คุณลักษณะ, การตัดสิน */}
          {/* ======================================================== */}
          {(activeSubTab === 'all_pages' || activeSubTab === 'p3_academic_results') && (
            <div>
              <div className="text-center mb-4">
                <h3 className="font-bold text-lg text-slate-900">สรุปผลสัมฤทธิ์ทางการเรียนและการประเมินตามหลักสูตร</h3>
                <p className="text-xs text-slate-600">
                  {fullReport.fullName} | เลขประจำตัว: {fullReport.studentCode} | ชั้น {gradeLevel} ห้อง {roomName} ปีการศึกษา {academicYear}
                </p>
              </div>

              {/* ตารางผลการเรียนรายวิชา (ตารางสำหรับ Export Excel ด้วย) */}
              <div className="border border-slate-800 rounded p-2 mb-4">
                <h5 className="font-bold text-xs text-slate-900 mb-1">๑. ผลการเรียนกลุ่มสาระการเรียนรู้</h5>
                <table id="obec-p6-table-export" className="w-full text-center border-collapse border border-slate-400 text-xs">
                  <thead>
                    <tr className="bg-slate-200 text-slate-900 font-bold">
                      <th className="border border-slate-400 py-1.5 px-2">ที่</th>
                      <th className="border border-slate-400 py-1.5 px-2">รหัสวิชา</th>
                      <th className="border border-slate-400 py-1.5 px-3 text-left">รายวิชา</th>
                      <th className="border border-slate-400 py-1.5 px-2">ชั่วโมง/ปี</th>
                      <th className="border border-slate-400 py-1.5 px-2">คะแนนเต็ม</th>
                      <th className="border border-slate-400 py-1.5 px-2">คะแนนที่ได้</th>
                      <th className="border border-slate-400 py-1.5 px-2">ร้อยละ</th>
                      <th className="border border-slate-400 py-1.5 px-2 bg-slate-300">ระดับผลการเรียน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fullReport.subjects.map((s, idx) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="border border-slate-400 py-1">{idx + 1}</td>
                        <td className="border border-slate-400 py-1 font-mono font-bold text-blue-900">{s.code}</td>
                        <td className="border border-slate-400 py-1 text-left px-3 font-semibold">{s.name}</td>
                        <td className="border border-slate-400 py-1">{s.hoursPerYear}</td>
                        <td className="border border-slate-400 py-1">100</td>
                        <td className="border border-slate-400 py-1 font-bold">{s.score100}</td>
                        <td className="border border-slate-400 py-1">{s.score100?.toFixed(2)}</td>
                        <td className="border border-slate-400 py-1 font-bold text-emerald-800 bg-emerald-50/50">
                          {s.grade}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-100 font-bold">
                      <td colSpan={3} className="border border-slate-400 py-1.5 text-right px-3">
                        รวมเวลาเรียน / ผลการเรียนเฉลี่ย (GPA)
                      </td>
                      <td className="border border-slate-400 py-1.5">{fullReport.totalHours}</td>
                      <td colSpan={3} className="border border-slate-400 py-1.5 text-right px-2">
                        เกรดเฉลี่ยสะสม:
                      </td>
                      <td className="border border-slate-400 py-1.5 text-blue-900 text-sm bg-blue-100">
                        {fullReport.gpa}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 2 & 3: กิจกรรมพัฒนาผู้เรียน และ คุณลักษณะอันพึงประสงค์ */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs mb-4">
                {/* กิจกรรมพัฒนาผู้เรียน */}
                <div className="border border-slate-800 rounded p-3 bg-slate-50/50">
                  <h5 className="font-bold text-slate-900 border-b border-slate-300 pb-1 mb-2">๒. กิจกรรมพัฒนาผู้เรียน</h5>
                  <table className="w-full text-center border-collapse border border-slate-300 text-[11px]">
                    <thead>
                      <tr className="bg-slate-200">
                        <th className="border border-slate-300 p-1 text-left">กิจกรรม</th>
                        <th className="border border-slate-300 p-1">เวลา (ชม.)</th>
                        <th className="border border-slate-300 p-1">ผลการประเมิน</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fullReport.evaluations.activities.map((act) => (
                        <tr key={act.name}>
                          <td className="border border-slate-300 p-1 text-left font-medium">{act.name}</td>
                          <td className="border border-slate-300 p-1">{act.hours}</td>
                          <td className="border border-slate-300 p-1 font-bold text-emerald-700">ผ (ผ่าน)</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-2 text-right font-bold text-[11px]">
                    สรุปผลกิจกรรม: <span className="text-emerald-700 underline">ผ่านทุกกิจกรรม</span>
                  </p>
                </div>

                {/* คุณลักษณะอันพึงประสงค์ 8 ข้อ */}
                <div className="border border-slate-800 rounded p-3 bg-slate-50/50">
                  <h5 className="font-bold text-slate-900 border-b border-slate-300 pb-1 mb-2">๓. คุณลักษณะอันพึงประสงค์ (๘ ข้อ)</h5>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
                    {fullReport.evaluations.characteristics.map((c) => (
                      <div key={c.id} className="flex justify-between border-b border-slate-200 pb-0.5">
                        <span className="text-slate-700">{c.id}. {c.title}</span>
                        <span className="font-bold text-blue-800">ดีเยี่ยม</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 pt-1 border-t border-slate-300 flex justify-between text-[11px] font-bold">
                    <span>การอ่าน คิดวิเคราะห์ และเขียน: <span className="text-emerald-700">ดีเยี่ยม</span></span>
                    <span>สรุปคุณลักษณะ: <span className="text-blue-800">ดีเยี่ยม</span></span>
                  </div>
                </div>
              </div>

              {/* สรุปผลการตัดสินเลื่อนชั้น */}
              <div className="border-2 border-slate-800 bg-amber-50/40 rounded p-4 text-center my-4">
                <h4 className="font-bold text-base text-slate-900 mb-1">ผลการตัดสินความก้าวหน้าและการเลื่อนชั้น</h4>
                <p className="text-sm font-bold text-emerald-800">
                  ✓ {fullReport.promotionDecision.promotionText} (มีผลการเรียนเฉลี่ย {fullReport.gpa})
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  ตัดสิน ณ วันที่ {fullReport.promotionDecision.decisionDate} ตามระเบียบกระทรวงศึกษาธิการว่าด้วยการประเมินผลการเรียน
                </p>
              </div>

              {/* ลายมือชื่อผู้อนุมัติ */}
              <div className="grid grid-cols-2 gap-8 my-6 text-center text-xs">
                <div>
                  <div className="h-8"></div>
                  <p className="font-bold">({schoolHeader.homeroomTeacherName})</p>
                  <p className="text-slate-600 mt-0.5">ครูประจำชั้น / ผู้รายงาน</p>
                </div>
                <div>
                  <div className="h-8"></div>
                  <p className="font-bold">({schoolHeader.directorName})</p>
                  <p className="text-slate-600 mt-0.5">{schoolHeader.directorPosition}</p>
                </div>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
};
