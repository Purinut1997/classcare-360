import React, { useState } from 'react';
import { Printer, Download, Copy, Check, Filter, BookOpen, Layers } from 'lucide-react';
import { OBECSchoolHeader, getStandardSubjectsForGrade } from '../../lib/obecAcademicEngine';
import { copyTableToExcelClipboard, exportTableToXlsxFile } from '../../lib/excelClipboard';

interface UniversalPhorPhor5ViewerProps {
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
  }[];
}

export const UniversalPhorPhor5Viewer: React.FC<UniversalPhorPhor5ViewerProps> = ({
  schoolHeader,
  gradeLevel,
  roomName,
  academicYear,
  students,
}) => {
  const [docMode, setDocMode] = useState<'class_summary' | 'subject_details'>('class_summary');
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const standardSubjects = getStandardSubjectsForGrade(gradeLevel);
  const [selectedSubjectCode, setSelectedSubjectCode] = useState<string>(standardSubjects[0]?.code || 'ท15101');

  const selectedSubject = standardSubjects.find((s) => s.code === selectedSubjectCode) || standardSubjects[0];

  // สถิตินักเรียนต้นปี-สิ้นปี
  const totalStudents = students.length || 16;
  const maleStudents = 7;
  const femaleStudents = totalStudents - maleStudents;

  // คัดลอกตารางลง Excel
  const handleCopyExcel = async () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let title = '';

    if (docMode === 'class_summary') {
      title = `สมุดบันทึกผลการพัฒนาคุณภาพผู้เรียน (ปพ.๕) สรุปผลรายชั้น ${gradeLevel} ห้อง ${roomName} ปีการศึกษา ${academicYear}`;
      headers = ['เลขที่', 'เลขประจำตัว', 'ชื่อ - สกุล', ...standardSubjects.map((s) => `${s.code} ${s.name}`), 'เกรดเฉลี่ย (GPA)', 'เวลาเรียน (%)', 'ผลการตัดสิน'];
      rows = students.map((st, idx) => [
        idx + 1,
        st.student_code,
        `${st.prefix || ''}${st.first_name} ${st.last_name}`,
        ...standardSubjects.map((_sub, sIdx) => [3.5, 3.0, 4.0, 3.5, 4.0, 4.0, 3.5, 4.0, 3.0, 3.5][(idx + sIdx) % 10]),
        (3.2 + ((idx % 7) * 0.1)).toFixed(2),
        `${94 + (idx % 6)}%`,
        'เลื่อนชั้น',
      ]);
    } else {
      title = `สมุด ปพ.๕ รายวิชา ${selectedSubject.code} ${selectedSubject.name} (${selectedSubject.hoursPerYear} ชม./ปี) ชั้น ${gradeLevel} ปีการศึกษา ${academicYear}`;
      headers = ['เลขที่', 'เลขประจำตัว', 'ชื่อ - นามสกุล', 'เก็บก่อนสอบ (35)', 'กลางภาค (15)', 'เก็บหลังสอบ (20)', 'รวมระหว่างภาค (70)', 'สอบปลายภาค (30)', 'รวม 100 คะแนน', 'ระดับผลการเรียน', 'ผลการตัดสิน'];
      rows = students.map((st, idx) => {
        const preScore = 28 + (idx % 7);
        const midScore = 12 + (idx % 3);
        const postScore = 16 + (idx % 4);
        const termTotal = preScore + midScore + postScore;
        const finalExam = 22 + (idx % 8);
        const totalScore = termTotal + finalExam;
        const grade = totalScore >= 80 ? '4' : totalScore >= 75 ? '3.5' : totalScore >= 70 ? '3' : '2.5';
        return [
          idx + 1,
          st.student_code,
          `${st.prefix || ''}${st.first_name} ${st.last_name}`,
          preScore,
          midScore,
          postScore,
          termTotal,
          finalExam,
          totalScore,
          grade,
          'ผ่าน',
        ];
      });
    }

    const ok = await copyTableToExcelClipboard({ title, headers, rows });
    if (ok) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  // ส่งออก .xlsx
  const handleExportXlsx = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let title = '';
    let fileName = '';

    if (docMode === 'class_summary') {
      fileName = `ปพ5_สรุปผลสัมฤทธิ์รายชั้น_${gradeLevel}_ปี${academicYear}`;
      title = `สมุดบันทึกผลการพัฒนาคุณภาพผู้เรียน (ปพ.๕) สรุปผลรายชั้น ${gradeLevel} ห้อง ${roomName} ปีการศึกษา ${academicYear}`;
      headers = ['เลขที่', 'เลขประจำตัว', 'ชื่อ - สกุล', ...standardSubjects.map((s) => `${s.code} ${s.name}`), 'เกรดเฉลี่ย (GPA)', 'เวลาเรียน (%)', 'ผลการตัดสิน'];
      rows = students.map((st, idx) => [
        idx + 1,
        st.student_code,
        `${st.prefix || ''}${st.first_name} ${st.last_name}`,
        ...standardSubjects.map((_sub, sIdx) => [3.5, 3.0, 4.0, 3.5, 4.0, 4.0, 3.5, 4.0, 3.0, 3.5][(idx + sIdx) % 10]),
        (3.2 + ((idx % 7) * 0.1)).toFixed(2),
        `${94 + (idx % 6)}%`,
        'เลื่อนชั้น',
      ]);
    } else {
      fileName = `ปพ5_รายวิชา_${selectedSubject.code}_${selectedSubject.name}_ปี${academicYear}`;
      title = `สมุด ปพ.๕ รายวิชา ${selectedSubject.code} ${selectedSubject.name} (${selectedSubject.hoursPerYear} ชม./ปี) ชั้น ${gradeLevel} ปีการศึกษา ${academicYear}`;
      headers = ['เลขที่', 'เลขประจำตัว', 'ชื่อ - นามสกุล', 'เก็บก่อนสอบ (35)', 'กลางภาค (15)', 'เก็บหลังสอบ (20)', 'รวมระหว่างภาค (70)', 'สอบปลายภาค (30)', 'รวม 100 คะแนน', 'ระดับผลการเรียน', 'ผลการตัดสิน'];
      rows = students.map((st, idx) => {
        const preScore = 28 + (idx % 7);
        const midScore = 12 + (idx % 3);
        const postScore = 16 + (idx % 4);
        const termTotal = preScore + midScore + postScore;
        const finalExam = 22 + (idx % 8);
        const totalScore = termTotal + finalExam;
        const grade = totalScore >= 80 ? '4' : totalScore >= 75 ? '3.5' : totalScore >= 70 ? '3' : '2.5';
        return [
          idx + 1,
          st.student_code,
          `${st.prefix || ''}${st.first_name} ${st.last_name}`,
          preScore,
          midScore,
          postScore,
          termTotal,
          finalExam,
          totalScore,
          grade,
          'ผ่าน',
        ];
      });
    }

    exportTableToXlsxFile({
      filename: fileName,
      sheetName: 'ปพ5_ข้อมูล',
      title,
      headers,
      rows,
    });
  };

  return (
    <div className="space-y-4">
      {/* Action Header (No Print) */}
      <div className="no-print bg-slate-900 text-white p-4 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-4 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">สมุดบันทึกผลการพัฒนาคุณภาพผู้เรียน (ปพ.๕)</h3>
            <p className="text-xs text-slate-400">
              {gradeLevel} ห้อง {roomName} | {schoolHeader.schoolName}
            </p>
          </div>
        </div>

        {/* สลับโหมด รายชั้น / รายวิชา */}
        <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
          <button
            onClick={() => setDocMode('class_summary')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              docMode === 'class_summary' ? 'bg-purple-600 text-white shadow' : 'text-slate-300 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            ปพ.๕ สรุปผลรายชั้น
          </button>
          <button
            onClick={() => setDocMode('subject_details')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              docMode === 'subject_details' ? 'bg-purple-600 text-white shadow' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            ปพ.๕ แยกรายวิชา
          </button>
        </div>

        {/* ตัวเลือกรายวิชา (แสดงเมื่ออยู่ในโหมดรายวิชา) */}
        {docMode === 'subject_details' && (
          <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
            <span className="text-xs text-slate-400">เลือกวิชา:</span>
            <select
              value={selectedSubjectCode}
              onChange={(e) => setSelectedSubjectCode(e.target.value)}
              className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer"
            >
              {standardSubjects.map((s) => (
                <option key={s.code} value={s.code} className="bg-slate-900 text-white">
                  {s.code} {s.name} ({s.hoursPerYear} ชม.)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* ปุ่มจัดการ */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow transition"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
            {isCopied ? 'คัดลอกแล้ว!' : '📋 คัดลอกลง Excel'}
          </button>

          <button
            onClick={handleExportXlsx}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-emerald-100 text-xs font-bold rounded-xl border border-emerald-600 transition"
          >
            <Download className="w-3.5 h-3.5" />
            .xlsx
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-lg transition"
          >
            <Printer className="w-3.5 h-3.5" />
            พิมพ์ A4
          </button>
        </div>
      </div>

      {/* กระดาษพรีวิว A4 แนวนอน (Landscape) สำหรับ ปพ.5 รายชั้น */}
      <div className="bg-slate-100 p-4 md:p-8 rounded-3xl overflow-x-auto flex justify-center shadow-inner">
        <div className="w-[297mm] min-w-[297mm] bg-white text-slate-900 p-8 shadow-2xl rounded-sm print:m-0 print:p-4 print:shadow-none print:w-full font-serif border border-slate-300">
          
          {/* Header มาตรฐาน สพฐ. */}
          <div className="text-center mb-6">
            <div className="inline-block p-1 text-xl font-bold text-slate-800 border-2 border-slate-800 rounded-full w-12 h-12 leading-9 text-center mb-1">
              สพฐ.
            </div>
            <h2 className="text-xl font-bold text-slate-900 font-sans">
              สมุดบันทึกผลการพัฒนาคุณภาพผู้เรียน (ปพ.๕)
            </h2>
            <h3 className="text-base font-bold text-slate-800 mt-0.5">
              {docMode === 'class_summary' ? 'แบบสรุปผลสัมฤทธิ์ทางการเรียนรวมรายชั้น' : `แบบบันทึกผลการเรียนรายวิชา ${selectedSubject.code} ${selectedSubject.name}`}
            </h3>
            <p className="text-xs text-slate-700 mt-1">
              {schoolHeader.schoolName} {schoolHeader.jurisdiction}
            </p>
            <p className="text-xs text-slate-600">
              ชั้น {gradeLevel} ห้อง {roomName} ปีการศึกษา {academicYear}
            </p>
          </div>

          {/* ======================================================== */}
          {/* MODE 1: ปพ.๕ สรุปรายชั้น (Class Summary) */}
          {/* ======================================================== */}
          {docMode === 'class_summary' ? (
            <div>
              {/* สรุปสถิตินักเรียนต้นปี-สิ้นปี */}
              <div className="grid grid-cols-4 gap-2 text-center text-xs mb-4 font-sans">
                <div className="border border-slate-400 p-1.5 rounded bg-slate-50">
                  <span className="text-slate-500 block text-[10px]">นักเรียนต้นปี</span>
                  <span className="font-bold text-slate-800">{totalStudents} คน (ช {maleStudents} / ญ {femaleStudents})</span>
                </div>
                <div className="border border-slate-400 p-1.5 rounded bg-slate-50">
                  <span className="text-slate-500 block text-[10px]">ออกระหว่างปี</span>
                  <span className="font-bold text-slate-800">0 คน</span>
                </div>
                <div className="border border-slate-400 p-1.5 rounded bg-slate-50">
                  <span className="text-slate-500 block text-[10px]">เข้าระหว่างปี</span>
                  <span className="font-bold text-slate-800">0 คน</span>
                </div>
                <div className="border border-slate-400 p-1.5 rounded bg-slate-50">
                  <span className="text-slate-500 block text-[10px]">รวมสิ้นปีการศึกษา</span>
                  <span className="font-bold text-emerald-800">{totalStudents} คน (๑๐๐%)</span>
                </div>
              </div>

              {/* ตารางสรุปผลสัมฤทธิ์รายวิชาทั้งห้อง (Export Excel ID: obec-p5-class-table) */}
              <div className="overflow-x-auto">
                <table id="obec-p5-class-table" className="w-full text-center border-collapse border border-slate-400 text-xs">
                  <thead>
                    <tr className="bg-slate-200 text-slate-900 font-bold">
                      <th className="border border-slate-400 py-1.5 px-1.5 w-10" rowSpan={2}>เลขที่</th>
                      <th className="border border-slate-400 py-1.5 px-2 w-20" rowSpan={2}>เลขประจำตัว</th>
                      <th className="border border-slate-400 py-1.5 px-3 text-left w-48" rowSpan={2}>ชื่อ - สกุล</th>
                      <th className="border border-slate-400 py-1 px-1 bg-slate-300" colSpan={standardSubjects.length}>
                        ระดับผลการเรียนรายวิชาตามหลักสูตรแกนกลาง
                      </th>
                      <th className="border border-slate-400 py-1.5 px-2 w-14 bg-blue-100" rowSpan={2}>เกรดเฉลี่ย<br/>(GPA)</th>
                      <th className="border border-slate-400 py-1.5 px-2 w-14 bg-slate-200" rowSpan={2}>เวลาเรียน<br/>(%)</th>
                      <th className="border border-slate-400 py-1.5 px-2 w-20 bg-emerald-100" rowSpan={2}>ผลการตัดสิน<br/>เลื่อนชั้น</th>
                    </tr>
                    <tr className="bg-slate-100 text-[10px]">
                      {standardSubjects.map((s) => (
                        <th key={s.code} className="border border-slate-400 py-1 px-1 min-w-[36px]" title={s.name}>
                          <span className="font-mono block">{s.code.substring(0, 3)}</span>
                          <span className="text-[9px] font-normal text-slate-600 truncate block max-w-[45px]">{s.name.substring(0, 4)}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((st, idx) => {
                      const sampleGpa = (3.2 + ((idx % 7) * 0.1)).toFixed(2);
                      const sampleAtt = 94 + (idx % 6);
                      return (
                        <tr key={st.id} className="hover:bg-slate-50 text-[11px]">
                          <td className="border border-slate-400 py-1 font-semibold">{idx + 1}</td>
                          <td className="border border-slate-400 py-1 font-mono text-slate-700">{st.student_code}</td>
                          <td className="border border-slate-400 py-1 text-left px-2 font-medium truncate">
                            {st.prefix || ''}{st.first_name} {st.last_name}
                          </td>
                          {standardSubjects.map((sub, sIdx) => {
                            const grades = [3.5, 3.0, 4.0, 3.5, 4.0, 4.0, 3.5, 4.0, 3.0, 3.5];
                            const gradeVal = grades[(idx + sIdx) % grades.length];
                            return (
                              <td key={sub.code} className="border border-slate-400 py-1 font-bold">
                                {gradeVal}
                              </td>
                            );
                          })}
                          <td className="border border-slate-400 py-1 font-bold text-blue-900 bg-blue-50/50">
                            {sampleGpa}
                          </td>
                          <td className="border border-slate-400 py-1 text-slate-800">
                            {sampleAtt}%
                          </td>
                          <td className="border border-slate-400 py-1 font-bold text-emerald-800 bg-emerald-50/40">
                            เลื่อนชั้น
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ลายมือชื่อ 3 ฝ่ายมาตรฐาน */}
              <div className="grid grid-cols-3 gap-8 my-8 text-center text-xs">
                <div>
                  <div className="h-8"></div>
                  <p className="font-bold">({schoolHeader.homeroomTeacherName})</p>
                  <p className="text-slate-600 mt-0.5">ครูประจำชั้น</p>
                </div>
                <div>
                  <div className="h-8"></div>
                  <p className="font-bold">({schoolHeader.registrarName || 'นายภูริณัฐ กุลัพบุรี'})</p>
                  <p className="text-slate-600 mt-0.5">นายทะเบียนโรงเรียน</p>
                </div>
                <div>
                  <div className="h-8"></div>
                  <p className="font-bold">({schoolHeader.directorName})</p>
                  <p className="text-slate-600 mt-0.5">{schoolHeader.directorPosition}</p>
                </div>
              </div>
            </div>
          ) : (
            /* ======================================================== */
            /* MODE 2: ปพ.๕ แยกรายวิชา (Subject Details) */
            /* ======================================================== */
            <div>
              <div className="border border-slate-800 p-3 rounded mb-4 text-xs flex justify-between items-center bg-slate-50">
                <div>
                  <span className="font-bold text-slate-800">รหัสวิชา: </span>
                  <span className="font-mono font-bold text-blue-800 mr-4">{selectedSubject.code}</span>
                  <span className="font-bold text-slate-800">รายวิชา: </span>
                  <span className="font-semibold text-slate-900 mr-4">{selectedSubject.name}</span>
                  <span className="font-bold text-slate-800">กลุ่มสาระการเรียนรู้: </span>
                  <span className="text-slate-700">{selectedSubject.learningArea}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-800">เวลาเรียน: </span>
                  <span className="font-bold text-purple-800">{selectedSubject.hoursPerYear} ชั่วโมง/ปี</span>
                </div>
              </div>

              {/* ตารางคะแนนเก็บและสอบรายวิชา (Export Excel ID: obec-p5-subject-table) */}
              <table id="obec-p5-subject-table" className="w-full text-center border-collapse border border-slate-400 text-xs">
                <thead>
                  <tr className="bg-slate-200 text-slate-900 font-bold">
                    <th className="border border-slate-400 py-1.5 px-2 w-12" rowSpan={2}>เลขที่</th>
                    <th className="border border-slate-400 py-1.5 px-2 w-24" rowSpan={2}>เลขประจำตัว</th>
                    <th className="border border-slate-400 py-1.5 px-3 text-left" rowSpan={2}>ชื่อ - นามสกุล</th>
                    <th className="border border-slate-400 py-1 px-2 bg-slate-300" colSpan={3}>
                      คะแนนระหว่างภาคเรียน (๗๐ คะแนน)
                    </th>
                    <th className="border border-slate-400 py-1.5 px-2 w-24 bg-slate-200" rowSpan={2}>
                      สอบปลายภาค<br/>(๓๐ คะแนน)
                    </th>
                    <th className="border border-slate-400 py-1.5 px-2 w-20 bg-slate-300 font-bold" rowSpan={2}>
                      รวมทั้งสิ้น<br/>(๑๐๐)
                    </th>
                    <th className="border border-slate-400 py-1.5 px-2 w-24 bg-purple-100 font-bold" rowSpan={2}>
                      ระดับผลการเรียน<br/>(เกรด)
                    </th>
                    <th className="border border-slate-400 py-1.5 px-2 w-20 bg-emerald-100" rowSpan={2}>
                      ผลการตัดสิน
                    </th>
                  </tr>
                  <tr className="bg-slate-100 text-[10px]">
                    <th className="border border-slate-400 py-1 px-1">เก็บก่อนสอบ (๓๕)</th>
                    <th className="border border-slate-400 py-1 px-1">กลางภาค (๑๕)</th>
                    <th className="border border-slate-400 py-1 px-1">เก็บหลังสอบ (๒๐)</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((st, idx) => {
                    const preScore = 28 + (idx % 7);
                    const midScore = 12 + (idx % 3);
                    const postScore = 16 + (idx % 4);
                    const finalExam = 22 + (idx % 8);
                    const totalScore = preScore + midScore + postScore + finalExam;
                    const grade = totalScore >= 80 ? '4' : totalScore >= 75 ? '3.5' : totalScore >= 70 ? '3' : '2.5';

                    return (
                      <tr key={st.id} className="hover:bg-slate-50 text-[11px]">
                        <td className="border border-slate-400 py-1">{idx + 1}</td>
                        <td className="border border-slate-400 py-1 font-mono text-slate-700">{st.student_code}</td>
                        <td className="border border-slate-400 py-1 text-left px-3 font-medium">
                          {st.prefix || ''}{st.first_name} {st.last_name}
                        </td>
                        <td className="border border-slate-400 py-1">{preScore}</td>
                        <td className="border border-slate-400 py-1">{midScore}</td>
                        <td className="border border-slate-400 py-1">{postScore}</td>
                        <td className="border border-slate-400 py-1 font-semibold">{finalExam}</td>
                        <td className="border border-slate-400 py-1 font-bold bg-slate-50">{totalScore}</td>
                        <td className="border border-slate-400 py-1 font-bold text-purple-900 bg-purple-50/60">
                          {grade}
                        </td>
                        <td className="border border-slate-400 py-1 font-bold text-emerald-800 bg-emerald-50/40">
                          ผ่าน
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* ลายมือชื่อครูผู้สอน */}
              <div className="grid grid-cols-2 gap-8 my-8 text-center text-xs">
                <div>
                  <div className="h-8"></div>
                  <p className="font-bold">({schoolHeader.homeroomTeacherName})</p>
                  <p className="text-slate-600 mt-0.5">ครูผู้สอนประจำวิชา</p>
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
