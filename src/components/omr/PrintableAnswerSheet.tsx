import { forwardRef, useState, useEffect } from 'react';
import QRCode from 'qrcode';
import type { AnswerSheetConfig, AnswerSheetThemeColor } from '../../types/omr';
import { CHOICE_KEYS_ABCD, getChoiceLabel } from '../../lib/omrEngine';

interface PrintableAnswerSheetProps {
  config: AnswerSheetConfig;
  schoolName?: string;
  studentName?: string;
  rollNumber?: number;
  isMiniPreview?: boolean;
}

export const PrintableAnswerSheet = forwardRef<HTMLDivElement, PrintableAnswerSheetProps>(
  ({ config, schoolName = 'โรงเรียน ClassCare 360', studentName, rollNumber, isMiniPreview = false }, ref) => {
    const isEcoHalf = config.layout === 'eco_half';

    // Calculate columns layout based on total questions and layout mode
    let questionsPerColumn = 15;
    if (isEcoHalf) {
      questionsPerColumn = config.totalQuestions <= 15 ? 15 : config.totalQuestions <= 20 ? 10 : 15;
    } else {
      questionsPerColumn = config.totalQuestions <= 20 ? 10 : config.totalQuestions <= 30 ? 15 : config.totalQuestions <= 45 ? 15 : 20;
    }
    const columnsCount = Math.ceil(config.totalQuestions / questionsPerColumn);
    const choiceKeys = CHOICE_KEYS_ABCD.slice(0, config.choicesCount);

    const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

    const theme: AnswerSheetThemeColor = config.themeColor || 'slate';

    const themeStyles = {
      slate: {
        border: 'border-slate-800',
        textPrimary: 'text-slate-900',
        bubbleBorder: 'border-slate-800',
        bubbleText: 'text-slate-900',
        headerBg: 'bg-slate-100',
        badgeBg: 'bg-slate-900',
      },
      navy: {
        border: 'border-blue-900',
        textPrimary: 'text-blue-900',
        bubbleBorder: 'border-blue-900',
        bubbleText: 'text-blue-900',
        headerBg: 'bg-blue-50',
        badgeBg: 'bg-blue-900',
      },
      burgundy: {
        border: 'border-[#701a2b]',
        textPrimary: 'text-[#701a2b]',
        bubbleBorder: 'border-[#701a2b]',
        bubbleText: 'text-[#701a2b]',
        headerBg: 'bg-[#fdf2f4]',
        badgeBg: 'bg-[#701a2b]',
      },
      emerald: {
        border: 'border-emerald-900',
        textPrimary: 'text-emerald-900',
        bubbleBorder: 'border-emerald-900',
        bubbleText: 'text-emerald-900',
        headerBg: 'bg-emerald-50',
        badgeBg: 'bg-emerald-900',
      },
    }[theme] || {
      border: 'border-slate-800',
      textPrimary: 'text-slate-900',
      bubbleBorder: 'border-slate-800',
      bubbleText: 'text-slate-900',
      headerBg: 'bg-slate-100',
      badgeBg: 'bg-slate-900',
    };

    const isDense = !isEcoHalf && (columnsCount >= 4 || (columnsCount >= 3 && config.choicesCount >= 5));

    // Determine clean official school name (avoid showing raw "ป.5" if workspace name was classroom)
    const rawSchool = config.schoolName?.trim() || schoolName?.trim() || '';
    const displaySchoolName = (rawSchool && rawSchool !== 'ป.5' && rawSchool !== 'J.5')
      ? rawSchool
      : 'โรงเรียน ClassCare 360';

    const isUniversal = config.isUniversalRoom !== false && !config.roomName;

    useEffect(() => {
      let isMounted = true;
      const payload = JSON.stringify({
        app: 'CC360',
        id: config.id,
        set: config.examSet || '01',
        sub: config.subjectName || '-',
        tid: config.teacherId ? config.teacherId.slice(0, 8) : 'GEN',
        room: isUniversal ? 'ALL' : (config.roomName || 'ALL'),
        tq: config.totalQuestions,
        ts: config.totalScore,
      });

      QRCode.toDataURL(payload, {
        margin: 0,
        width: 160,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url) => {
          if (isMounted) setQrCodeUrl(url);
        })
        .catch(() => {});

      return () => {
        isMounted = false;
      };
    }, [config.id, config.examSet, config.subjectName, config.teacherId, config.roomName, isUniversal, config.totalQuestions, config.totalScore]);

    const renderSheetInstance = (instanceKey: string) => (
      <div
        key={instanceKey}
        className={`relative flex flex-col justify-between bg-white text-slate-900 select-none ${
          isEcoHalf ? 'p-3.5' : 'p-6'
        }`}
        style={{
          width: '210mm',
          height: isEcoHalf ? '144mm' : '297mm',
          maxHeight: isEcoHalf ? '144mm' : '297mm',
          boxSizing: 'border-box',
          overflow: 'hidden',
          fontFamily: "'Anuphan', 'Noto Sans Thai', -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        {/* 4 Precision Fiducial Corner Registration Marks for OMR AI Vision */}
        <div className={`absolute left-3 top-3 border-l-4 border-t-4 border-black ${isEcoHalf ? 'h-4 w-4' : 'h-5 w-5'}`} />
        <div className={`absolute right-3 top-3 border-r-4 border-t-4 border-black ${isEcoHalf ? 'h-4 w-4' : 'h-5 w-5'}`} />
        <div className={`absolute bottom-3 left-3 border-l-4 border-b-4 border-black ${isEcoHalf ? 'h-4 w-4' : 'h-5 w-5'}`} />
        <div className={`absolute bottom-3 right-3 border-r-4 border-b-4 border-black ${isEcoHalf ? 'h-4 w-4' : 'h-5 w-5'}`} />

        {/* Vertical OMR Optical Timing Track on right edge */}
        <div className="absolute right-1 top-12 bottom-12 flex flex-col justify-between pointer-events-none opacity-80">
          {Array.from({ length: isEcoHalf ? 16 : 28 }).map((_, i) => (
            <div key={i} className="w-1.5 h-1 bg-black" />
          ))}
        </div>

        {/* --- 1. OFFICIAL EXAM HEADER & INSTITUTION BANNER --- */}
        <div className="mx-2">
          <div className={`flex items-start justify-between border-b-2 border-slate-900 ${isEcoHalf ? 'pb-1.5' : 'pb-2'}`}>
            <div className="flex items-center gap-3">
              {/* Official Academic Crest / Emblem */}
              <div className={`flex items-center justify-center rounded-lg ${themeStyles.badgeBg} text-white shadow-xs ${
                isEcoHalf ? 'h-9 w-9' : 'h-11 w-11'
              }`}>
                <svg className={isEcoHalf ? 'h-5 w-5 text-amber-300' : 'h-6 w-6 text-amber-300'} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L1 7l11 5 9-4.09V17h2V7L12 2z" />
                  <path d="M4 10.18v5.82L12 21l8-5V10.18L12 15l-8-4.82z" opacity="0.85" />
                </svg>
              </div>

              <div>
                <p className={`font-black tracking-wide text-slate-700 ${isEcoHalf ? 'text-[10px]' : 'text-xs'}`}>
                  {displaySchoolName}
                </p>
                <h1 className={`font-black tracking-tight leading-tight ${themeStyles.textPrimary} ${
                  isEcoHalf ? 'text-sm' : 'text-lg'
                }`}>
                  {config.title || 'กระดาษคำตอบมาตรฐาน (OMR Answer Sheet)'}
                </h1>
                <p className={`font-semibold text-slate-500 ${isEcoHalf ? 'text-[8.5px]' : 'text-[10.5px]'}`}>
                  แบบทดสอบวัดผลสัมฤทธิ์ทางการเรียนรู้ตามมาตรฐานหลักสูตร • สพฐ. / สทศ.
                </p>
              </div>
            </div>

            {/* Quick Metadata Box, Exam Set & QR Code */}
            <div className="flex items-center gap-2">
              {/* Machine-readable Exam Set QR Code */}
              {config.showQrCode !== false && (
                <div className={`flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white shadow-2xs ${
                  isEcoHalf ? 'p-1' : 'p-1.5'
                }`}>
                  <div className={`overflow-hidden rounded bg-white flex items-center justify-center border border-slate-200 ${
                    isEcoHalf ? 'h-9 w-9' : 'h-11 w-11'
                  }`}>
                    {qrCodeUrl ? (
                      <img src={qrCodeUrl} alt="Exam QR" className="h-full w-full object-contain" />
                    ) : (
                      <div className="h-full w-full bg-slate-100 flex items-center justify-center text-[7px] font-mono text-slate-400">
                        QR
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col justify-center text-left">
                    <span className="text-[7px] uppercase font-black tracking-wider text-slate-400 leading-none">
                      QR ชุดข้อสอบ
                    </span>
                    <span className="rounded bg-slate-900 px-1.5 py-0.2 font-mono text-[9px] font-black text-white text-center my-0.5 leading-tight">
                      ชุด {config.examSet || '01'}
                    </span>
                    <span className="font-mono text-[7px] text-slate-500 font-bold leading-none">
                      ID:{config.id ? config.id.slice(-5).toUpperCase() : 'CC360'}
                    </span>
                  </div>
                </div>
              )}

              {/* Quick Metadata Badges */}
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-1.5">
                  <div className="rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-center">
                    <span className="text-[7.5px] text-slate-500 font-bold uppercase block leading-none">ชุดที่</span>
                    <span className="font-mono text-xs font-black text-slate-900">{config.examSet || '01'}</span>
                  </div>
                  <div className="rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-center">
                    <span className="text-[7.5px] text-slate-500 font-bold uppercase block leading-none">จำนวนข้อ</span>
                    <span className="font-mono text-xs font-black text-slate-900">{config.totalQuestions}</span>
                  </div>
                  <div className="rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-center">
                    <span className="text-[7.5px] text-slate-500 font-bold uppercase block leading-none">คะแนนเต็ม</span>
                    <span className="font-mono text-xs font-black text-slate-900">{config.totalScore}</span>
                  </div>
                </div>

                {/* Subject & Date pills */}
                <div className={`flex flex-wrap items-center gap-1.5 text-slate-600 font-bold ${
                  isEcoHalf ? 'text-[8.5px]' : 'text-[10px]'
                }`}>
                  <span>วิชา: <strong className="text-slate-900">{config.subjectName || '-'}</strong></span>
                  <span>•</span>
                  <span>วันที่: <strong className="text-slate-900">{config.examDate || '-'}</strong></span>
                  <span>•</span>
                  <span>
                    {isUniversal ? (
                      <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1 py-0.2">
                        ใช้ได้ทุกห้อง (กรอกเอง)
                      </span>
                    ) : (
                      <span>ห้อง: <strong className="text-slate-900">{config.roomName}</strong></span>
                    )}
                  </span>
                  {config.teacherName ? (
                    <>
                      <span>•</span>
                      <span>ครูผู้สอน: <strong className="text-slate-900">{config.teacherName}</strong></span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {/* --- 2. STRUCTURED STUDENT IDENTIFICATION & SHADING GUIDE CARD --- */}
          <div className={`mt-2 grid grid-cols-12 gap-3 rounded-xl border border-slate-300 bg-slate-50/60 ${
            isEcoHalf ? 'p-2' : 'p-2.5'
          }`}>
            {/* Left 8-9 cols: Student Info Fields & Visual Shading Instructions */}
            <div className={`${config.studentIdFormat !== 'none' ? 'col-span-8 sm:col-span-9' : 'col-span-12'} flex flex-col justify-between space-y-1.5`}>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-700 bg-white border border-slate-300 rounded px-1.5 py-0.2">
                    ข้อมูลผู้เข้าสอบ (Student Information)
                  </span>
                </div>

                <div className="space-y-1">
                  {/* Student Name */}
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold text-slate-700 whitespace-nowrap text-[10.5px]">ชื่อ - สกุล:</span>
                    <span className="flex-1 border-b border-dotted border-slate-400 pb-0.5 font-bold text-slate-900 text-xs">
                      {studentName || ''}
                    </span>
                  </div>

                  {/* Classroom, Roll Number, Exam Room */}
                  <div className="flex items-baseline gap-4 pt-0.5">
                    <div className="flex items-baseline gap-2 flex-1">
                      <span className="font-bold text-slate-700 whitespace-nowrap text-[10.5px]">ระดับชั้น / ห้อง:</span>
                      <span className="flex-1 border-b border-dotted border-slate-400 pb-0.5 font-semibold text-slate-800 text-xs">
                        {isUniversal ? '' : (config.roomName || '')}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-2">
                      <span className="font-bold text-slate-700 whitespace-nowrap text-[10.5px]">เลขที่:</span>
                      <span className="w-14 border-b border-dotted border-slate-400 pb-0.5 text-center font-mono font-bold text-slate-900 text-xs">
                        {rollNumber ? String(rollNumber).padStart(2, '0') : ''}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-2">
                      <span className="font-bold text-slate-700 whitespace-nowrap text-[10.5px]">ห้องสอบ:</span>
                      <span className="w-16 border-b border-dotted border-slate-400 pb-0.5 text-center text-xs"></span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Visual Shading Instructions (คำแนะนำการฝนดินสอ 2B) */}
              <div className="rounded-lg border border-slate-200 bg-white px-2 py-1 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[9.5px] text-slate-600">
                  <span className="font-black text-slate-800">คำชี้แจง:</span>
                  <span>ใช้ดินสอดำ <strong>2B</strong> ขึ้นไป ฝนในวงกลมให้ดำเต็มวง (ห้ามใช้ปากกา)</span>
                </div>

                <div className="flex items-center gap-2 text-[9px] font-bold">
                  <span className="inline-flex items-center gap-1 text-slate-900">
                    <span className="inline-block h-3.5 w-3.5 rounded-full bg-slate-900 text-[8px] text-white text-center leading-3.5">
                      ●
                    </span>
                    ถูก
                  </span>
                  <span className="inline-flex items-center gap-0.5 text-slate-400">
                    <span className="inline-block h-3.5 w-3.5 rounded-full border border-slate-400 text-[8px] text-center leading-3">
                      ✕
                    </span>
                    ผิด
                  </span>
                  <span className="inline-flex items-center gap-0.5 text-slate-400">
                    <span className="inline-block h-3.5 w-3.5 rounded-full border border-slate-400 text-[8px] text-center leading-3">
                      ✔
                    </span>
                    ผิด
                  </span>
                </div>
              </div>
            </div>

            {/* Right 3-4 cols: Official Roll Number / Student ID Matrix */}
            {config.studentIdFormat === 'roll_number' && (
              <div className="col-span-4 sm:col-span-3 rounded-lg border border-slate-300 bg-white p-1 text-center flex flex-col justify-between">
                <div className="text-[8.5px] font-black text-slate-700 bg-slate-100 py-0.5 rounded border-b border-slate-200">
                  เลขที่ (00-99)
                </div>

                <div className="flex justify-center gap-3 my-0.5">
                  {['สิบ', 'หน่วย'].map((lbl, cIdx) => (
                    <div key={lbl} className="flex flex-col items-center">
                      <span className="text-[7.5px] text-slate-500 font-bold mb-0.5">{lbl}</span>
                      <div className="h-4 w-4 mb-1 rounded border border-slate-400 bg-slate-50 text-center font-mono text-[10px] font-black leading-4">
                        {rollNumber ? (cIdx === 0 ? Math.floor(rollNumber / 10) : rollNumber % 10) : ''}
                      </div>
                      <div className="space-y-0.5">
                        {Array.from({ length: 10 }).map((_, digit) => (
                          <div
                            key={digit}
                            className={`flex items-center justify-center rounded-full border-[1.2px] ${themeStyles.bubbleBorder} font-black ${themeStyles.bubbleText} ${
                              isEcoHalf ? 'h-2.5 w-2.5 text-[6.5px]' : 'h-3 w-3 text-[7.5px]'
                            }`}
                          >
                            {digit}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {config.studentIdFormat === 'student_code' && (
              <div className="col-span-4 sm:col-span-3 rounded-lg border border-slate-300 bg-white p-1 text-center flex flex-col justify-between">
                <div className="text-[8.5px] font-black text-slate-700 bg-slate-100 py-0.5 rounded border-b border-slate-200">
                  รหัสประจำตัว (5 หลัก)
                </div>

                <div className="flex justify-center gap-1.5 my-0.5">
                  {['1', '2', '3', '4', '5'].map((colNum) => (
                    <div key={colNum} className="flex flex-col items-center">
                      <span className="text-[7px] text-slate-400 mb-0.5">{colNum}</span>
                      <div className="h-3.5 w-3.5 mb-0.5 rounded border border-slate-400 bg-slate-50 text-center font-mono text-[9px] font-bold leading-3.5" />
                      <div className="space-y-0.5">
                        {Array.from({ length: 10 }).map((_, digit) => (
                          <div
                            key={digit}
                            className={`flex items-center justify-center rounded-full border ${themeStyles.bubbleBorder} font-bold ${themeStyles.bubbleText} ${
                              isEcoHalf ? 'h-2 w-2 text-[5.5px]' : 'h-2.5 w-2.5 text-[6.5px]'
                            }`}
                          >
                            {digit}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* --- 3. PROFESSIONAL CLEAN ANSWER GRID --- */}
        <div
          className={`mx-auto flex-1 grid gap-3 ${isEcoHalf ? 'my-1.5' : 'my-2.5'} w-full items-start`}
          style={{
            gridTemplateColumns: `repeat(${columnsCount}, minmax(0, 1fr))`,
            maxWidth: columnsCount === 1 ? '260px' : columnsCount === 2 ? '540px' : '100%',
          }}
        >
          {Array.from({ length: columnsCount }).map((_, colIdx) => {
            const startQ = colIdx * questionsPerColumn + 1;
            const endQ = Math.min(config.totalQuestions, (colIdx + 1) * questionsPerColumn);
            const questions = [];
            for (let q = startQ; q <= endQ; q++) questions.push(q);

            return (
              <div
                key={colIdx}
                className="flex flex-col rounded-xl border border-slate-300 bg-white overflow-hidden shadow-2xs"
              >
                {/* Column Table Header with Elegant Shading */}
                <div className={`flex items-center justify-center border-b-2 border-slate-300 ${themeStyles.headerBg} font-black text-slate-800 ${
                  isEcoHalf
                    ? 'py-1 text-[10px] gap-2'
                    : isDense
                    ? 'py-1.5 text-[11px] gap-2'
                    : 'py-1.5 text-xs gap-2.5'
                }`}>
                  <span className={`text-center font-bold text-slate-800 ${
                    isEcoHalf || isDense ? 'w-6 text-[10px]' : 'w-7 text-xs'
                  }`}>
                    ข้อ
                  </span>
                  <div className={`flex ${isEcoHalf || isDense ? 'gap-1.5' : 'gap-2'}`}>
                    {choiceKeys.map((_, i) => (
                      <span
                        key={i}
                        className={`text-center font-black text-slate-800 ${
                          isEcoHalf || isDense ? 'w-4 text-[10px]' : 'w-5 text-xs'
                        }`}
                      >
                        {getChoiceLabel(i, config.choiceLabelType)}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Question rows with whitespace every 5 questions and subtle zebra striping */}
                <div className="flex-1 divide-y divide-slate-100">
                  {questions.map((q) => {
                    const isFifthBreak = q % 5 === 0 && q !== endQ;
                    const isEven = q % 2 === 0;

                    return (
                      <div
                        key={q}
                        className={`${isEven ? 'bg-slate-50/40' : 'bg-white'} ${
                          isFifthBreak ? (isEcoHalf ? 'pb-1 border-b-2 border-slate-200' : 'pb-1.5 border-b-2 border-slate-200') : ''
                        }`}
                      >
                        <div className={`flex items-center justify-center ${
                          isEcoHalf || isDense ? 'gap-2 py-0.8' : 'gap-2.5 py-1'
                        }`}>
                          <span className={`text-right font-mono font-bold text-slate-700 pr-0.5 ${
                            isEcoHalf || isDense ? 'w-6 text-[10px]' : 'w-7 text-[11.5px]'
                          }`}>
                            {q}.
                          </span>

                          <div className={`flex ${isEcoHalf || isDense ? 'gap-1.5' : 'gap-2'}`}>
                            {choiceKeys.map((_, cIdx) => (
                              <div
                                key={cIdx}
                                className={`flex items-center justify-center rounded-full border-[1.5px] ${themeStyles.bubbleBorder} font-black ${themeStyles.bubbleText} bg-white shadow-2xs ${
                                  isEcoHalf || isDense
                                    ? 'h-4 w-4 text-[8.5px]'
                                    : 'h-5 w-5 text-[9.5px]'
                                }`}
                              >
                                {getChoiceLabel(cIdx, config.choiceLabelType)}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* --- 4. OFFICIAL EXAMINER & SCORE CERTIFICATION FOOTER --- */}
        <div className={`mx-2 flex items-center justify-between border-t-2 border-slate-800 ${
          isEcoHalf ? 'pt-1.5 text-[9.5px]' : 'pt-2 text-xs'
        } text-slate-600`}>
          <div className="flex flex-col">
            <span className="font-bold text-slate-700">
              ระบบตรวจกระดาษคำตอบอัตโนมัติ ClassCare 360 AI OMR
            </span>
            <span className="text-[8.5px] text-slate-400 font-mono">
              SECURITY REGISTRATION • ACCURACY VERIFIED • A4 HIGH RESOLUTION
            </span>
          </div>

          {/* Teacher Official Score Box */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1">
              <span className="font-black text-slate-800">คะแนนที่ได้ (Score):</span>
              <div className={`rounded border border-slate-400 bg-white ${
                isEcoHalf ? 'h-5 w-12' : 'h-6 w-14'
              }`} />
              <span className="font-mono font-bold text-slate-800">
                / {config.totalScore}
              </span>
            </div>

            <div className={`text-slate-500 font-semibold ${isEcoHalf ? 'hidden sm:block text-[9px]' : 'text-[10px]'}`}>
              ลงชื่อครูผู้ตรวจ: ...........................................
            </div>
          </div>
        </div>
      </div>
    );

    if (isMiniPreview) {
      return (
        <div
          ref={ref}
          className="omr-mini-preview select-none pointer-events-none bg-white"
          style={{
            width: '210mm',
            height: '297mm',
            maxHeight: '297mm',
            boxSizing: 'border-box',
            overflow: 'hidden',
          }}
        >
          {renderSheetInstance('instance-1')}
          {isEcoHalf && (
            <>
              <div
                className="flex items-center justify-center border-t border-dashed border-slate-400 text-slate-400"
                style={{ height: '9mm', boxSizing: 'border-box' }}
              >
                <span className="bg-white px-3 text-[9px] font-mono tracking-wider">
                  ✂ - - - - - - - - - - รอยตัดครึ่งแผ่น A4 (Cut here) - - - - - - - - - -
                </span>
              </div>
              {renderSheetInstance('instance-2')}
            </>
          )}
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className="omr-printable-container mx-auto bg-white shadow-md print:m-0 print:p-0 print:shadow-none"
        style={{
          width: '210mm',
          height: '297mm',
          maxHeight: '297mm',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        <style>
          {`
            @media print {
              @page {
                size: A4 portrait !important;
                margin: 0mm !important;
              }
              body * {
                visibility: hidden !important;
              }
              .omr-printable-container,
              .omr-printable-container * {
                visibility: visible !important;
              }
              .omr-printable-container {
                position: fixed !important;
                left: 0 !important;
                top: 0 !important;
                width: 210mm !important;
                height: 297mm !important;
                max-height: 297mm !important;
                margin: 0 !important;
                padding: 0 !important;
                background: white !important;
                z-index: 9999999 !important;
                overflow: hidden !important;
                box-shadow: none !important;
              }
            }
          `}
        </style>

        {renderSheetInstance('instance-1')}

        {isEcoHalf && (
          <>
            {/* Cut line between the two half sheets (9mm exact height) */}
            <div
              className="flex items-center justify-center border-t border-dashed border-slate-400 text-slate-400"
              style={{ height: '9mm', boxSizing: 'border-box' }}
            >
              <span className="bg-white px-3 text-[9px] font-mono tracking-wider">
                ✂ - - - - - - - - - - รอยตัดครึ่งแผ่น A4 (Cut here) - - - - - - - - - -
              </span>
            </div>
            {renderSheetInstance('instance-2')}
          </>
        )}
      </div>
    );
  }
);

PrintableAnswerSheet.displayName = 'PrintableAnswerSheet';
