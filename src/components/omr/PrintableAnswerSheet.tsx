import { forwardRef } from 'react';
import type { AnswerSheetConfig, AnswerSheetThemeColor } from '../../types/omr';
import { CHOICE_KEYS_ABCD, getChoiceLabel } from '../../lib/omrEngine';

interface PrintableAnswerSheetProps {
  config: AnswerSheetConfig;
  schoolName?: string;
  studentName?: string;
  rollNumber?: number;
}

export const PrintableAnswerSheet = forwardRef<HTMLDivElement, PrintableAnswerSheetProps>(
  ({ config, schoolName = 'โรงเรียนต้นแบบ ClassCare 360', studentName, rollNumber }, ref) => {
    const questionsPerColumn = config.totalQuestions <= 30 ? 15 : config.totalQuestions <= 60 ? 25 : 35;
    const columnsCount = Math.ceil(config.totalQuestions / questionsPerColumn);
    const choiceKeys = CHOICE_KEYS_ABCD.slice(0, config.choicesCount);

    const theme: AnswerSheetThemeColor = config.themeColor || 'burgundy';

    // Theme color palettes (Border, Accent, Header BG, Light Zebra BG)
    const themeStyles = {
      burgundy: {
        border: 'border-[#701a2b]',
        borderLight: 'border-[#b91c1c]/40',
        textPrimary: 'text-[#701a2b]',
        textHeader: 'text-[#881337]',
        bgHeader: 'bg-[#fff1f2]',
        bgBadge: 'bg-[#881337]',
        badgeText: 'text-white',
        zebraBg: 'bg-[#fff5f5]',
        bubbleBorder: 'border-[#881337]',
        bubbleText: 'text-[#881337]',
        bannerBar: 'bg-[#701a2b]',
        tintBox: 'bg-[#fdf2f4]',
      },
      navy: {
        border: 'border-[#1e3a8a]',
        borderLight: 'border-[#3b82f6]/40',
        textPrimary: 'text-[#1e3a8a]',
        textHeader: 'text-[#1e3a8a]',
        bgHeader: 'bg-[#eff6ff]',
        bgBadge: 'bg-[#1e3a8a]',
        badgeText: 'text-white',
        zebraBg: 'bg-[#f0f7ff]',
        bubbleBorder: 'border-[#1e3a8a]',
        bubbleText: 'text-[#1e3a8a]',
        bannerBar: 'bg-[#1e3a8a]',
        tintBox: 'bg-[#f0f4fc]',
      },
      slate: {
        border: 'border-slate-900',
        borderLight: 'border-slate-400',
        textPrimary: 'text-slate-900',
        textHeader: 'text-slate-900',
        bgHeader: 'bg-slate-100',
        bgBadge: 'bg-slate-900',
        badgeText: 'text-white',
        zebraBg: 'bg-slate-50',
        bubbleBorder: 'border-slate-900',
        bubbleText: 'text-slate-900',
        bannerBar: 'bg-slate-900',
        tintBox: 'bg-slate-50',
      },
      emerald: {
        border: 'border-[#064e3b]',
        borderLight: 'border-[#059669]/40',
        textPrimary: 'text-[#064e3b]',
        textHeader: 'text-[#065f46]',
        bgHeader: 'bg-[#ecfdf5]',
        bgBadge: 'bg-[#064e3b]',
        badgeText: 'text-white',
        zebraBg: 'bg-[#f0fdf4]',
        bubbleBorder: 'border-[#064e3b]',
        bubbleText: 'text-[#064e3b]',
        bannerBar: 'bg-[#064e3b]',
        tintBox: 'bg-[#f0fdf7]',
      },
    }[theme];

    const renderSheetInstance = (instanceKey: string) => (
      <div
        key={instanceKey}
        className={`relative mx-auto flex flex-col justify-between border-[2.5px] ${themeStyles.border} bg-white p-5 shadow-sm print:m-0 print:border-2 print:border-black print:p-4 print:shadow-none`}
        style={{
          width: '210mm',
          minHeight: config.layout === 'eco_half' ? '142mm' : '290mm',
          maxHeight: config.layout === 'eco_half' ? '146mm' : '296mm',
          boxSizing: 'border-box',
          pageBreakInside: 'avoid',
          fontFamily: "'Anuphan', 'Noto Sans Thai', sans-serif",
        }}
      >
        {/* 4 Precision Fiducial Corner Targets for OMR Vision Registration */}
        <div className="absolute left-2.5 top-2.5 flex h-7 w-7 items-center justify-center bg-black print:bg-black">
          <div className="h-2 w-2 bg-white" />
        </div>
        <div className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center bg-black print:bg-black">
          <div className="h-2 w-2 bg-white" />
        </div>
        <div className="absolute bottom-2.5 left-2.5 flex h-7 w-7 items-center justify-center bg-black print:bg-black">
          <div className="h-2 w-2 bg-white" />
        </div>
        <div className="absolute bottom-2.5 right-2.5 flex h-7 w-7 items-center justify-center bg-black print:bg-black">
          <div className="h-2 w-2 bg-white" />
        </div>

        {/* Left & Right Vertical Timing Tracks (OMR Optical Timing Marks) */}
        <div
          className="absolute left-1.5 top-14 bottom-14 flex flex-col justify-between items-center pointer-events-none"
          aria-hidden="true"
        >
          {Array.from({ length: 32 }).map((_, i) => (
            <div key={i} className="h-1.5 w-2 bg-black print:bg-black my-0.5" />
          ))}
        </div>
        <div
          className="absolute right-1.5 top-14 bottom-14 flex flex-col justify-between items-center pointer-events-none"
          aria-hidden="true"
        >
          {Array.from({ length: 32 }).map((_, i) => (
            <div key={i} className="h-1.5 w-2 bg-black print:bg-black my-0.5" />
          ))}
        </div>

        {/* TOP SECTION: OFFICIAL EXAMINATION HEADER */}
        <div className="mx-2">
          {/* Top Decorative Title Bar */}
          <div className={`flex items-center justify-between border-b-2 ${themeStyles.border} pb-2`}>
            {/* Left: Official Emblem Placeholder & Institution Title */}
            <div className="flex items-center gap-3">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border-2 ${themeStyles.border} ${themeStyles.bgHeader} text-center`}
              >
                <div className="space-y-0.5">
                  <div className={`text-[9px] font-black uppercase ${themeStyles.textPrimary}`}>CC360</div>
                  <div className="h-0.5 w-7 bg-current mx-auto" />
                  <div className="text-[7.5px] font-bold text-slate-500">EXAM</div>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block rounded px-1.5 py-0.2 text-[9.5px] font-black tracking-wider uppercase ${themeStyles.bgBadge} ${themeStyles.badgeText}`}
                  >
                    กระดาษคำตอบมาตรฐาน
                  </span>
                  <span className="text-[10px] font-bold text-slate-600 print:text-black">
                    {schoolName}
                  </span>
                </div>
                <h1 className={`text-lg font-black tracking-tight ${themeStyles.textHeader} print:text-black leading-tight mt-0.5`}>
                  {config.title || 'แบบทดสอบวัดผลสัมฤทธิ์ทางการเรียน'}
                </h1>
                <p className="text-[11px] font-semibold text-slate-700 print:text-black">
                  กลุ่มสาระฯ/วิชา: <span className="font-black text-slate-900">{config.subjectName || '-'}</span> | ชั้น:{' '}
                  <span className="font-bold">{config.roomName || 'ประถมศึกษา'}</span> | วันที่:{' '}
                  <span className="font-bold">{config.examDate || '-'}</span>
                </p>
              </div>
            </div>

            {/* Right: Exam Code, Set & Barcode */}
            <div className="flex flex-col items-end text-right">
              <div className="flex items-center gap-1.5">
                <div className={`rounded border ${themeStyles.border} px-2 py-0.5 text-center`}>
                  <div className="text-[8px] font-bold uppercase text-slate-500">ชุดที่</div>
                  <div className={`text-xs font-black font-mono ${themeStyles.textPrimary}`}>
                    {config.examSet || '01'}
                  </div>
                </div>
                <div className={`rounded border ${themeStyles.border} px-2 py-0.5 text-center`}>
                  <div className="text-[8px] font-bold uppercase text-slate-500">จำนวนข้อ</div>
                  <div className={`text-xs font-black font-mono ${themeStyles.textPrimary}`}>
                    {config.totalQuestions}
                  </div>
                </div>
                <div className={`rounded border ${themeStyles.border} px-2 py-0.5 text-center`}>
                  <div className="text-[8px] font-bold uppercase text-slate-500">คะแนนเต็ม</div>
                  <div className={`text-xs font-black font-mono ${themeStyles.textPrimary}`}>
                    {config.totalScore}
                  </div>
                </div>
              </div>

              {/* Simulated High-Res Barcode */}
              <div className="mt-1 flex flex-col items-end">
                <div className="flex h-5 items-stretch gap-0.5 print:filter-none">
                  {[3, 1, 2, 1, 4, 1, 2, 3, 1, 2, 1, 3, 2, 1, 4, 1, 2, 3, 1, 3, 2, 1, 4].map(
                    (w, idx) => (
                      <div
                        key={idx}
                        className={`bg-black ${idx % 2 === 0 ? 'bg-black' : 'bg-transparent'}`}
                        style={{ width: `${w * 1.1}px` }}
                      />
                    )
                  )}
                </div>
                <span className="font-mono text-[8px] font-bold text-slate-600 print:text-black tracking-widest mt-0.5">
                  *CC360-{config.totalQuestions}Q-{config.choicesCount}C*
                </span>
              </div>
            </div>
          </div>

          {/* MIDDLE HEADER: STUDENT INFORMATION & BUBBLE ROLL NUMBER */}
          <div className="mt-2 grid grid-cols-12 gap-3 text-xs">
            {/* Box 1: Examinee Personal Details & Signatures */}
            <div className={`col-span-8 rounded-lg border ${themeStyles.border} p-2.5 ${themeStyles.tintBox} print:border-black print:bg-white flex flex-col justify-between space-y-2`}>
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-8 flex items-center gap-1.5">
                  <span className="font-bold text-slate-900 text-[11px] shrink-0">ชื่อ - สกุล:</span>
                  <div className="flex-1 border-b border-dotted border-slate-600 pb-0.5 font-bold text-slate-900 text-[11px] truncate">
                    {studentName || ''}
                  </div>
                </div>
                <div className="col-span-4 flex items-center gap-1.5">
                  <span className="font-bold text-slate-900 text-[11px] shrink-0">เลขที่:</span>
                  <div className="flex-1 border-b border-dotted border-slate-600 pb-0.5 text-center font-mono font-black text-slate-900 text-[11px]">
                    {rollNumber ? String(rollNumber).padStart(2, '0') : ''}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-12 gap-2 text-[11px]">
                <div className="col-span-5 flex items-center gap-1.5">
                  <span className="font-bold text-slate-900 shrink-0">ห้องเรียน / ชั้น:</span>
                  <div className="flex-1 border-b border-dotted border-slate-600 pb-0.5 font-semibold text-slate-800">
                    {config.roomName || ''}
                  </div>
                </div>
                <div className="col-span-4 flex items-center gap-1.5">
                  <span className="font-bold text-slate-900 shrink-0">ห้องสอบ:</span>
                  <div className="flex-1 border-b border-dotted border-slate-600 pb-0.5 text-center font-semibold">
                    -
                  </div>
                </div>
                <div className="col-span-3 flex items-center gap-1.5">
                  <span className="font-bold text-slate-900 shrink-0">ที่นั่งสอบ:</span>
                  <div className="flex-1 border-b border-dotted border-slate-600 pb-0.5 text-center font-mono font-bold">
                    {rollNumber ? String(rollNumber).padStart(2, '0') : ''}
                  </div>
                </div>
              </div>

              {/* Instructions & Proper Bubble Filling Demonstration */}
              <div className="rounded border border-slate-300 bg-white p-1.5 text-[10px] leading-tight text-slate-700 print:border-slate-400">
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-900">
                    คำชี้แจง: ใช้ดินสอดำ 2B ขึ้นไป ฝนทับวงกลมให้ดำสนิทเต็มวง
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-0.5 font-bold text-emerald-800">
                      <span className="inline-block h-3.5 w-3.5 rounded-full bg-slate-950 text-[8px] text-white text-center leading-3.5">
                        ●
                      </span>{' '}
                      ถูก
                    </span>
                    <span className="flex items-center gap-0.5 text-slate-500">
                      <span className="inline-block h-3.5 w-3.5 rounded-full border border-slate-400 text-[8px] text-center leading-3 text-rose-500">
                        ✕
                      </span>{' '}
                      ผิด
                    </span>
                    <span className="flex items-center gap-0.5 text-slate-500">
                      <span className="inline-block h-3.5 w-3.5 rounded-full border border-slate-400 text-[8px] text-center leading-3 text-rose-500">
                        ✓
                      </span>{' '}
                      ผิด
                    </span>
                  </div>
                </div>
                <p className="text-[9.5px] text-slate-600 mt-0.5">
                  *ห้ามพับกระดาษ ห้ามทำให้ยับหรือฉีกขาด หากต้องการเปลี่ยนคำตอบให้ลบด้วยยางลบให้สะอาดหมดจดก่อนฝนข้อใหม่
                </p>
              </div>

              {/* Signatures */}
              <div className="flex items-center justify-between pt-0.5 text-[10px] text-slate-700">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold">ลงชื่อผู้เข้าสอบ:</span>
                  <div className="w-28 border-b border-slate-400" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold">ลงชื่อกรรมการคุมสอบ:</span>
                  <div className="w-28 border-b border-slate-400" />
                </div>
              </div>
            </div>

            {/* Box 2: Official Bubble ID Grid (Student Code or Roll No.) */}
            <div className={`col-span-4 rounded-lg border ${themeStyles.border} p-1.5 ${themeStyles.bgHeader} print:border-black print:bg-white flex flex-col justify-between`}>
              <div className={`border-b ${themeStyles.border} pb-1 text-center font-black text-[10.5px] ${themeStyles.textPrimary}`}>
                {config.studentIdFormat === 'roll_number'
                  ? 'เลขที่นั่งสอบ / เลขที่ (00 - 99)'
                  : config.studentIdFormat === 'student_code'
                  ? 'รหัสประจำตัวผู้เข้าสอบ (5 หลัก)'
                  : 'การระบุตัวตน'}
              </div>

              {config.studentIdFormat === 'roll_number' ? (
                <div className="mt-1">
                  {/* Top Numeric Box */}
                  <div className="flex justify-center gap-4 mb-1">
                    {['หลักสิบ', 'หลักหน่วย'].map((lbl, cIdx) => (
                      <div key={lbl} className="flex flex-col items-center">
                        <span className="text-[8px] font-bold text-slate-600 mb-0.5">{lbl}</span>
                        <div className="flex h-5 w-7 items-center justify-center rounded border border-slate-700 bg-white font-mono text-xs font-black text-slate-950 print:border-black">
                          {rollNumber
                            ? cIdx === 0
                              ? Math.floor(rollNumber / 10)
                              : rollNumber % 10
                            : ''}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Bubble Columns 0-9 */}
                  <div className="flex justify-center gap-4">
                    {[0, 1].map((colIndex) => (
                      <div key={colIndex} className="space-y-0.5">
                        {Array.from({ length: 10 }).map((_, digit) => (
                          <div
                            key={digit}
                            className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border ${themeStyles.bubbleBorder} text-[8px] font-bold ${themeStyles.bubbleText} print:border-black print:text-black`}
                          >
                            {digit}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ) : config.studentIdFormat === 'student_code' ? (
                <div className="mt-1">
                  {/* Top Numeric Boxes (5 digits) */}
                  <div className="flex justify-center gap-1.5 mb-1">
                    {['หมื่น', 'พัน', 'ร้อย', 'สิบ', 'หน่วย'].map((lbl, cIdx) => (
                      <div key={cIdx} className="flex flex-col items-center">
                        <span className="text-[7.5px] font-bold text-slate-600 mb-0.5">{lbl}</span>
                        <div className="flex h-4 w-5 items-center justify-center rounded border border-slate-700 bg-white font-mono text-[10px] font-black text-slate-950 print:border-black">
                          {/* Digit placeholder */}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Bubble Columns 0-9 (5 columns) */}
                  <div className="flex justify-center gap-1.5">
                    {Array.from({ length: 5 }).map((_, colIndex) => (
                      <div key={colIndex} className="space-y-0.5">
                        {Array.from({ length: 10 }).map((_, digit) => (
                          <div
                            key={digit}
                            className={`flex h-3 w-3 items-center justify-center rounded-full border ${themeStyles.bubbleBorder} text-[7.5px] font-bold ${themeStyles.bubbleText} print:border-black print:text-black`}
                          >
                            {digit}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-[10px] text-slate-500">
                  <div className="font-bold text-slate-700">โหมดบุคคลทั่วไป</div>
                  <div>(ไม่ต้องระบายรหัส)</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* MAIN BODY: HIGH-PRECISION QUESTION ANSWER GRID */}
        <div
          className="my-3 mx-2 flex-1 grid gap-3"
          style={{ gridTemplateColumns: `repeat(${columnsCount}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columnsCount }).map((_, colIdx) => {
            const startQ = colIdx * questionsPerColumn + 1;
            const endQ = Math.min(config.totalQuestions, (colIdx + 1) * questionsPerColumn);
            const questions = [];
            for (let q = startQ; q <= endQ; q++) questions.push(q);

            return (
              <div
                key={colIdx}
                className={`flex flex-col justify-between rounded-lg border ${themeStyles.border} p-1.5 text-xs print:border print:border-black`}
              >
                {/* Column Column Header */}
                <div
                  className={`mb-1.5 flex items-center justify-between rounded px-2 py-1 text-[10.5px] font-black ${themeStyles.bgHeader} ${themeStyles.textPrimary} border-b ${themeStyles.borderLight} print:bg-slate-100 print:text-black`}
                >
                  <span className="w-6 text-center font-mono">ข้อ</span>
                  <div className="flex gap-2">
                    {choiceKeys.map((_, i) => (
                      <span key={i} className="w-5 text-center font-bold">
                        {getChoiceLabel(i, config.choiceLabelType)}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Questions List with 5-Question Zebra Striping */}
                <div className="space-y-0.5 flex-1">
                  {questions.map((q) => {
                    // Alternate background every 5 questions for professional readability
                    const isZebraBlock = Math.floor((q - 1) / 5) % 2 === 1;

                    return (
                      <div
                        key={q}
                        className={`flex items-center justify-between rounded px-1.5 py-0.5 transition ${
                          isZebraBlock ? themeStyles.zebraBg : 'bg-transparent'
                        }`}
                      >
                        <span className="w-6 text-right font-mono text-[11px] font-black text-slate-900 print:text-black">
                          {q}.
                        </span>

                        <div className="flex gap-2">
                          {choiceKeys.map((_, cIdx) => (
                            <div
                              key={cIdx}
                              className={`flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] ${themeStyles.bubbleBorder} text-[9.5px] font-black ${themeStyles.bubbleText} print:border-black print:text-black bg-white shadow-2xs`}
                            >
                              {getChoiceLabel(cIdx, config.choiceLabelType)}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Subtotal / Checksum bar for column */}
                <div className="mt-1.5 border-t border-slate-200 pt-1 text-center font-mono text-[8px] text-slate-400 print:text-black">
                  SEC-{colIdx + 1} • {startQ} - {endQ}
                </div>
              </div>
            );
          })}
        </div>

        {/* BOTTOM SECTION: FOR OFFICIAL EXAMINERS ONLY & OFFICIAL SEAL */}
        <div className={`mx-2 border-t-2 ${themeStyles.border} pt-2 text-[10px]`}>
          <div className="grid grid-cols-12 gap-3 items-center">
            {/* Left: OMR System Identity & Security Stamp */}
            <div className="col-span-7 flex items-center gap-3 text-slate-600 print:text-black">
              <div className="h-7 w-7 rounded border border-slate-400 bg-slate-100 flex items-center justify-center text-[7px] font-mono font-bold text-center leading-tight">
                OMR
                <br />
                PASS
              </div>
              <div className="space-y-0.5">
                <div className="font-black text-slate-900 text-[10.5px]">
                  ระบบตรวจข้อสอบอัตโนมัติ ClassCare 360 AI Computer Vision
                </div>
                <div className="text-[9px] text-slate-500 print:text-black">
                  ใบกระดาษคำตอบมาตรฐานฉบับทางการ • มีผลผูกพันตามเกณฑ์วัดและประเมินผลสถานศึกษา
                </div>
              </div>
            </div>

            {/* Right: Examiner Official Score Recording Box */}
            <div className="col-span-5 flex items-center justify-end gap-2 text-right">
              <div className={`rounded-lg border-2 ${themeStyles.border} px-3 py-1 bg-white print:border-black flex items-center gap-3`}>
                <div className="text-left">
                  <span className="text-[8.5px] font-bold text-slate-500 uppercase block leading-none">
                    คะแนนที่ได้ (Score)
                  </span>
                  <span className="text-[10px] font-bold text-slate-900">ตรวจโดยเครื่อง OMR</span>
                </div>
                <div className="h-6 w-16 rounded border border-slate-400 bg-slate-50 print:bg-white text-center font-mono font-black text-sm leading-6">
                  {/* Empty box for score */}
                </div>
                <span className="font-mono font-bold text-slate-700 text-xs">
                  / {config.totalScore}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );

    return (
      <div ref={ref} className="omr-printable-container print:p-0">
        <style>
          {`
            @media print {
              body {
                background: white !important;
                color: black !important;
              }
              header, nav, aside, footer, .no-print {
                display: none !important;
              }
              .omr-printable-container {
                margin: 0 !important;
                padding: 0 !important;
              }
              @page {
                size: A4 portrait;
                margin: 5mm;
              }
            }
          `}
        </style>

        {renderSheetInstance('instance-1')}

        {config.layout === 'eco_half' && (
          <div className="mt-4 print:mt-4 print:pt-4 print:border-t-2 print:border-dashed print:border-slate-400">
            {renderSheetInstance('instance-2')}
          </div>
        )}
      </div>
    );
  }
);

PrintableAnswerSheet.displayName = 'PrintableAnswerSheet';
