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
    let questionsPerColumn = 10;
    if (isEcoHalf) {
      // In 2-in-1 Eco Half (144mm), keep at most 10-12 rows per column to ensure zero vertical overflow
      questionsPerColumn = config.totalQuestions <= 10 ? 10 : config.totalQuestions <= 50 ? 10 : 12;
    } else {
      // In Single Full A4 (297mm), balance vertically according to question count
      if (config.totalQuestions <= 15) questionsPerColumn = 15;
      else if (config.totalQuestions <= 20) questionsPerColumn = 10;
      else if (config.totalQuestions <= 30) questionsPerColumn = 15;
      else if (config.totalQuestions <= 40) questionsPerColumn = 20;
      else if (config.totalQuestions <= 50) questionsPerColumn = 25;
      else if (config.totalQuestions <= 60) questionsPerColumn = 20;
      else if (config.totalQuestions <= 80) questionsPerColumn = 20;
      else questionsPerColumn = 25;
    }

    const columnsCount = Math.max(1, Math.ceil(config.totalQuestions / questionsPerColumn));
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
          isEcoHalf ? 'px-6 py-2.5' : 'px-8 py-5'
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
        {/* 4 Precision Fiducial Corner Registration Marks for OMR AI Vision (Sitting safely outside inner content) */}
        <div className={`absolute left-2.5 top-2.5 border-l-[3.5px] border-t-[3.5px] border-black ${isEcoHalf ? 'h-3.5 w-3.5' : 'h-5 w-5'}`} />
        <div className={`absolute right-2.5 top-2.5 border-r-[3.5px] border-t-[3.5px] border-black ${isEcoHalf ? 'h-3.5 w-3.5' : 'h-5 w-5'}`} />
        <div className={`absolute bottom-2.5 left-2.5 border-l-[3.5px] border-b-[3.5px] border-black ${isEcoHalf ? 'h-3.5 w-3.5' : 'h-5 w-5'}`} />
        <div className={`absolute bottom-2.5 right-2.5 border-r-[3.5px] border-b-[3.5px] border-black ${isEcoHalf ? 'h-3.5 w-3.5' : 'h-5 w-5'}`} />

        {/* Vertical OMR Optical Timing Track on left edge margin */}
        <div className="absolute left-1 top-8 bottom-8 flex flex-col justify-between pointer-events-none opacity-80">
          {Array.from({ length: isEcoHalf ? 18 : 32 }).map((_, i) => (
            <div key={i} className="w-1.5 h-1 bg-black" />
          ))}
        </div>

        {/* --- 1. OFFICIAL EXAM HEADER & INSTITUTION BANNER --- */}
        <div className="w-full">
          <div className={`flex items-center justify-between border-b-2 border-slate-900 ${isEcoHalf ? 'pb-1' : 'pb-2'}`}>
            {/* Left: Academic Crest & School / Exam Title */}
            <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
              <div className={`flex items-center justify-center rounded-lg ${themeStyles.badgeBg} text-white shadow-xs shrink-0 ${
                isEcoHalf ? 'h-8 w-8' : 'h-11 w-11'
              }`}>
                <svg className={isEcoHalf ? 'h-4.5 w-4.5 text-amber-300' : 'h-6 w-6 text-amber-300'} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L1 7l11 5 9-4.09V17h2V7L12 2z" />
                  <path d="M4 10.18v5.82L12 21l8-5V10.18L12 15l-8-4.82z" opacity="0.85" />
                </svg>
              </div>

              <div className="min-w-0">
                <p className={`font-black tracking-wide text-slate-600 truncate ${isEcoHalf ? 'text-[9px]' : 'text-xs'}`}>
                  {displaySchoolName}
                </p>
                <h1 className={`font-black tracking-tight leading-snug truncate ${themeStyles.textPrimary} ${
                  isEcoHalf ? 'text-xs sm:text-[13px]' : 'text-lg'
                }`}>
                  {config.title || 'กระดาษคำตอบมาตรฐาน (OMR Answer Sheet)'}
                </h1>
                <p className={`font-semibold text-slate-500 truncate ${isEcoHalf ? 'text-[7.5px]' : 'text-[10px]'}`}>
                  แบบทดสอบวัดผลสัมฤทธิ์ทางการเรียนรู้ตามมาตรฐานหลักสูตร • สพฐ. / สทศ.
                </p>
              </div>
            </div>

            {/* Center: Official Exam Set Badge (Like Thai National Exam GAT/PAT & สพฐ.) */}
            <div className={`shrink-0 text-center rounded-lg border-2 ${themeStyles.border} bg-white shadow-2xs ${
              isEcoHalf ? 'px-2 py-0.5 mx-1.5' : 'px-3.5 py-1 mx-3'
            }`}>
              <div className="text-[7px] uppercase font-black tracking-wider text-slate-500 leading-tight">
                ชุดข้อสอบ
              </div>
              <div className={`font-black font-mono leading-none ${themeStyles.textPrimary} ${
                isEcoHalf ? 'text-xs' : 'text-xl'
              }`}>
                ชุดที่ {config.examSet || '01'}
              </div>
              <div className="text-[6.5px] font-mono text-slate-400 font-bold leading-tight">
                (Set {config.examSet || '01'})
              </div>
            </div>

            {/* Right: QR Code & Score Badges */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Machine-readable Exam Set QR Code */}
              {config.showQrCode !== false && (
                <div className={`flex items-center gap-1 rounded border border-slate-300 bg-white shadow-2xs ${
                  isEcoHalf ? 'p-0.8' : 'p-1.5'
                }`}>
                  <div className={`overflow-hidden rounded bg-white flex items-center justify-center border border-slate-200 ${
                    isEcoHalf ? 'h-7 w-7' : 'h-11 w-11'
                  }`}>
                    {qrCodeUrl ? (
                      <img src={qrCodeUrl} alt="Exam QR" className="h-full w-full object-contain" />
                    ) : (
                      <div className="h-full w-full bg-slate-100 flex items-center justify-center text-[6px] font-mono text-slate-400">
                        QR
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col justify-center text-left leading-none">
                    <span className="text-[6px] uppercase font-black tracking-wider text-slate-400 mb-0.5">
                      QR ชุดข้อสอบ
                    </span>
                    <span className="font-mono text-[7px] font-bold text-slate-800">
                      ID:{config.id ? config.id.slice(-5).toUpperCase() : 'CC360'}
                    </span>
                    <span className="text-[5.5px] text-emerald-700 font-bold mt-0.5">
                      auto-grade
                    </span>
                  </div>
                </div>
              )}

              {/* Badges: Total Questions & Total Score */}
              <div className="flex flex-col gap-0.5">
                <div className={`rounded border border-slate-300 bg-slate-50 text-center ${
                  isEcoHalf ? 'px-1 py-0.2' : 'px-2 py-0.5'
                }`}>
                  <span className="text-[6.5px] text-slate-500 font-bold uppercase block leading-none">จำนวนข้อ</span>
                  <span className={`font-mono font-black text-slate-900 leading-none ${
                    isEcoHalf ? 'text-[9.5px]' : 'text-xs'
                  }`}>{config.totalQuestions}</span>
                </div>
                <div className={`rounded border border-slate-300 bg-slate-50 text-center ${
                  isEcoHalf ? 'px-1 py-0.2' : 'px-2 py-0.5'
                }`}>
                  <span className="text-[6.5px] text-slate-500 font-bold uppercase block leading-none">คะแนนเต็ม</span>
                  <span className={`font-mono font-black text-slate-900 leading-none ${
                    isEcoHalf ? 'text-[9.5px]' : 'text-xs'
                  }`}>{config.totalScore}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Subject, Exam Date, Room, Teacher metadata strip */}
          <div className={`flex flex-wrap items-center justify-between text-slate-600 font-semibold border-b border-slate-200 bg-slate-50/70 rounded-b px-2 ${
            isEcoHalf ? 'py-0.5 text-[8px]' : 'py-1 text-[10px]'
          }`}>
            <div className="flex items-center gap-2.5">
              <span>วิชา: <strong className="text-slate-900">{config.subjectName || '-'}</strong></span>
              <span>•</span>
              <span>วันที่: <strong className="text-slate-900">{config.examDate || '-'}</strong></span>
              <span>•</span>
              <span>
                {isUniversal ? (
                  <span className="text-emerald-700 font-bold">ใช้ได้ทุกห้อง (กรอกเอง)</span>
                ) : (
                  <span>ห้อง: <strong className="text-slate-900">{config.roomName}</strong></span>
                )}
              </span>
            </div>
            {config.teacherName && (
              <div>
                <span>ครูผู้สอน: <strong className="text-slate-900">{config.teacherName}</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* --- 2. STRUCTURED STUDENT IDENTIFICATION & SHADING GUIDE CARD --- */}
        <div className={`grid grid-cols-12 gap-2 rounded-lg border border-slate-300 bg-slate-50/50 ${
          isEcoHalf ? 'mt-1 p-1.5' : 'mt-2 p-2.5'
        }`}>
          {/* Left: Student Info Inputs & Shading Instructions */}
          <div className={`${config.studentIdFormat !== 'none' ? 'col-span-8 sm:col-span-9' : 'col-span-12'} flex flex-col justify-between`}>
            <div className={isEcoHalf ? 'space-y-0.5' : 'space-y-1'}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={`font-black uppercase tracking-wider text-slate-700 bg-white border border-slate-300 rounded px-1.5 py-0.2 ${
                  isEcoHalf ? 'text-[8px]' : 'text-[9.5px]'
                }`}>
                  ข้อมูลผู้เข้าสอบ (STUDENT INFORMATION)
                </span>
              </div>

              {/* Student Name */}
              <div className="flex items-baseline gap-2">
                <span className={`font-bold text-slate-700 whitespace-nowrap ${isEcoHalf ? 'text-[9px]' : 'text-xs'}`}>
                  ชื่อ - สกุล:
                </span>
                <span className={`flex-1 border-b border-dotted border-slate-400 font-bold text-slate-900 ${
                  isEcoHalf ? 'text-[9.5px] pb-0.2' : 'text-xs pb-0.5'
                }`}>
                  {studentName || ''}
                </span>
              </div>

              {/* Classroom, Roll Number, Exam Room */}
              <div className="flex items-baseline gap-2.5 pt-0.2">
                <div className="flex items-baseline gap-1 flex-1">
                  <span className={`font-bold text-slate-700 whitespace-nowrap ${isEcoHalf ? 'text-[9px]' : 'text-xs'}`}>
                    ระดับชั้น / ห้อง:
                  </span>
                  <span className={`flex-1 border-b border-dotted border-slate-400 font-semibold text-slate-800 ${
                    isEcoHalf ? 'text-[9px]' : 'text-xs'
                  }`}>
                    {isUniversal ? '' : (config.roomName || '')}
                  </span>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className={`font-bold text-slate-700 whitespace-nowrap ${isEcoHalf ? 'text-[9px]' : 'text-xs'}`}>
                    เลขที่:
                  </span>
                  <span className={`w-10 border-b border-dotted border-slate-400 text-center font-mono font-bold text-slate-900 ${
                    isEcoHalf ? 'text-[9.5px]' : 'text-xs'
                  }`}>
                    {rollNumber ? String(rollNumber).padStart(2, '0') : ''}
                  </span>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className={`font-bold text-slate-700 whitespace-nowrap ${isEcoHalf ? 'text-[9px]' : 'text-xs'}`}>
                    ห้องสอบ:
                  </span>
                  <span className={`w-12 border-b border-dotted border-slate-400 text-center ${
                    isEcoHalf ? 'text-[9px]' : 'text-xs'
                  }`}></span>
                </div>
              </div>
            </div>

            {/* Shading Instructions (คำแนะนำการฝนดินสอ 2B) */}
            <div className={`mt-1 rounded border border-slate-200 bg-white flex items-center justify-between gap-1.5 ${
              isEcoHalf ? 'px-1.5 py-0.5' : 'px-2.5 py-1'
            }`}>
              <div className={`flex items-center gap-1 text-slate-600 ${isEcoHalf ? 'text-[8px]' : 'text-[9.5px]'}`}>
                <span className="font-black text-slate-800">คำชี้แจง:</span>
                <span>ใช้ดินสอดำ <strong>2B</strong> ขึ้นไป ฝนให้ดำเต็มวง (ห้ามใช้ปากกา)</span>
              </div>

              <div className={`flex items-center gap-1.5 font-bold ${isEcoHalf ? 'text-[7.5px]' : 'text-[9px]'}`}>
                <span className="inline-flex items-center gap-0.8 text-slate-900">
                  <span className={`inline-block rounded-full bg-slate-900 text-white text-center font-bold ${
                    isEcoHalf ? 'h-3 w-3 text-[6.5px] leading-3' : 'h-3.5 w-3.5 text-[8px] leading-3.5'
                  }`}>
                    ●
                  </span>
                  ถูก
                </span>
                <span className="inline-flex items-center gap-0.5 text-slate-400">
                  <span className={`inline-block rounded-full border border-slate-400 text-center ${
                    isEcoHalf ? 'h-3 w-3 text-[6.5px] leading-3' : 'h-3.5 w-3.5 text-[8px] leading-3'
                  }`}>
                    ✕
                  </span>
                  ผิด
                </span>
                <span className="inline-flex items-center gap-0.5 text-slate-400">
                  <span className={`inline-block rounded-full border border-slate-400 text-center ${
                    isEcoHalf ? 'h-3 w-3 text-[6.5px] leading-3' : 'h-3.5 w-3.5 text-[8px] leading-3'
                  }`}>
                    ✔
                  </span>
                  ผิด
                </span>
              </div>
            </div>
          </div>

          {/* Right: Roll Number / Student ID Matrix (Proportionally scaled to never exceed height) */}
          {config.studentIdFormat === 'roll_number' && (
            <div className={`col-span-4 sm:col-span-3 rounded border border-slate-300 bg-white p-1 text-center flex flex-col justify-between ${
              isEcoHalf ? 'max-h-[105px]' : ''
            }`}>
              <div className="text-[7.5px] font-black text-slate-700 bg-slate-100 py-0.2 rounded border-b border-slate-200 leading-tight">
                เลขที่ (00-99)
              </div>

              <div className="flex justify-center gap-2 my-0.2">
                {['สิบ', 'หน่วย'].map((lbl, cIdx) => (
                  <div key={lbl} className="flex flex-col items-center">
                    <span className="text-[6.5px] text-slate-500 font-bold leading-none mb-0.2">{lbl}</span>
                    <div className={`mb-0.5 rounded border border-slate-400 bg-slate-50 text-center font-mono font-black ${
                      isEcoHalf ? 'h-3.5 w-3.5 text-[8px] leading-3.5' : 'h-4 w-4 text-[10px] leading-4'
                    }`}>
                      {rollNumber ? (cIdx === 0 ? Math.floor(rollNumber / 10) : rollNumber % 10) : ''}
                    </div>
                    <div className={isEcoHalf ? 'space-y-0.2' : 'space-y-0.5'}>
                      {Array.from({ length: 10 }).map((_, digit) => (
                        <div
                          key={digit}
                          className={`flex items-center justify-center rounded-full border-[1.2px] ${themeStyles.bubbleBorder} font-black ${themeStyles.bubbleText} ${
                            isEcoHalf ? 'h-2 w-2 text-[5.5px]' : 'h-3 w-3 text-[7.5px]'
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
            <div className={`col-span-4 sm:col-span-3 rounded border border-slate-300 bg-white p-1 text-center flex flex-col justify-between ${
              isEcoHalf ? 'max-h-[105px]' : ''
            }`}>
              <div className="text-[7.5px] font-black text-slate-700 bg-slate-100 py-0.2 rounded border-b border-slate-200 leading-tight">
                รหัสประจำตัว (5 หลัก)
              </div>

              <div className="flex justify-center gap-1 my-0.2">
                {['1', '2', '3', '4', '5'].map((colNum) => (
                  <div key={colNum} className="flex flex-col items-center">
                    <span className="text-[6px] text-slate-400 leading-none mb-0.2">{colNum}</span>
                    <div className={`mb-0.5 rounded border border-slate-400 bg-slate-50 text-center font-mono font-bold ${
                      isEcoHalf ? 'h-3 w-3 text-[7.5px] leading-3' : 'h-3.5 w-3.5 text-[9px] leading-3.5'
                    }`} />
                    <div className={isEcoHalf ? 'space-y-0.2' : 'space-y-0.5'}>
                      {Array.from({ length: 10 }).map((_, digit) => (
                        <div
                          key={digit}
                          className={`flex items-center justify-center rounded-full border ${themeStyles.bubbleBorder} font-bold ${themeStyles.bubbleText} ${
                            isEcoHalf ? 'h-1.8 w-1.8 text-[5px]' : 'h-2.5 w-2.5 text-[6.5px]'
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

        {/* --- 3. PROFESSIONAL CLEAN ANSWER GRID --- */}
        <div
          className={`mx-auto flex-1 grid gap-2.5 ${isEcoHalf ? 'my-1' : 'my-2.5'} w-full items-start`}
          style={{
            gridTemplateColumns: `repeat(${columnsCount}, minmax(0, 1fr))`,
            maxWidth: columnsCount === 1 ? '240px' : columnsCount === 2 ? '480px' : columnsCount === 3 ? '720px' : '100%',
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
                className="flex flex-col rounded-lg border border-slate-300 bg-white overflow-hidden shadow-2xs"
              >
                {/* Column Table Header with Elegant Shading */}
                <div className={`flex items-center justify-center border-b-2 border-slate-300 ${themeStyles.headerBg} font-black text-slate-800 ${
                  isEcoHalf
                    ? 'py-0.8 text-[9px] gap-1.5'
                    : isDense
                    ? 'py-1 text-[10.5px] gap-2'
                    : 'py-1.5 text-xs gap-2.5'
                }`}>
                  <span className={`text-center font-bold text-slate-800 ${
                    isEcoHalf ? 'w-5 text-[8.5px]' : isDense ? 'w-6 text-[10px]' : 'w-7 text-xs'
                  }`}>
                    ข้อ
                  </span>
                  <div className={`flex ${isEcoHalf ? 'gap-1' : isDense ? 'gap-1.5' : 'gap-2'}`}>
                    {choiceKeys.map((_, i) => (
                      <span
                        key={i}
                        className={`text-center font-black text-slate-800 ${
                          isEcoHalf ? 'w-3.5 text-[8.5px]' : isDense ? 'w-4 text-[10px]' : 'w-5 text-xs'
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
                          isFifthBreak ? (isEcoHalf ? 'pb-0.5 border-b-2 border-slate-200' : 'pb-1 border-b-2 border-slate-200') : ''
                        }`}
                      >
                        <div className={`flex items-center justify-center ${
                          isEcoHalf ? 'gap-1.5 py-0.5' : isDense ? 'gap-2 py-0.8' : 'gap-2.5 py-1'
                        }`}>
                          <span className={`text-right font-mono font-bold text-slate-700 pr-0.5 ${
                            isEcoHalf ? 'w-5 text-[9px]' : isDense ? 'w-6 text-[10px]' : 'w-7 text-[11px]'
                          }`}>
                            {q}.
                          </span>

                          <div className={`flex ${isEcoHalf ? 'gap-1' : isDense ? 'gap-1.5' : 'gap-2'}`}>
                            {choiceKeys.map((_, cIdx) => (
                              <div
                                key={cIdx}
                                className={`flex items-center justify-center rounded-full border-[1.4px] ${themeStyles.bubbleBorder} font-black ${themeStyles.bubbleText} bg-white shadow-2xs ${
                                  isEcoHalf
                                    ? 'h-3.5 w-3.5 text-[7.5px]'
                                    : isDense
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

        {/* --- 4. OFFICIAL EXAMINER & SCORE CERTIFICATION FOOTER (Safely inside borders, never sliced) --- */}
        <div className={`w-full flex items-center justify-between border-t-2 border-slate-900 ${
          isEcoHalf ? 'pt-1 pb-0.5 text-[8.5px]' : 'pt-2 pb-1 text-xs'
        } text-slate-600`}>
          <div className="flex flex-col">
            <span className="font-bold text-slate-800">
              ระบบตรวจกระดาษคำตอบอัตโนมัติ ClassCare 360 AI OMR
            </span>
            <span className="text-[7.5px] text-slate-400 font-mono tracking-tight">
              OFFICIAL EXAMINATION STANDARD • SECURITY VERIFIED • HIGH RESOLUTION
            </span>
          </div>

          {/* Teacher Official Score Box & Signature */}
          <div className="flex items-center gap-2.5">
            <div className={`flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded ${
              isEcoHalf ? 'px-1.5 py-0.5' : 'px-2.5 py-1'
            }`}>
              <span className="font-black text-slate-800">คะแนนที่ได้ (Score):</span>
              <div className={`rounded border border-slate-400 bg-white ${
                isEcoHalf ? 'h-4 w-10' : 'h-6 w-14'
              }`} />
              <span className="font-mono font-bold text-slate-800">
                / {config.totalScore}
              </span>
            </div>

            <div className={`text-slate-500 font-semibold ${isEcoHalf ? 'text-[8px]' : 'text-[10px]'}`}>
              ลงชื่อครูผู้ตรวจ: .......................................
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
