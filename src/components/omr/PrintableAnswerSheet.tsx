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
  ({ config, schoolName = 'โรงเรียน ClassCare 360', studentName, rollNumber }, ref) => {
    const questionsPerColumn = config.totalQuestions <= 30 ? 15 : config.totalQuestions <= 60 ? 25 : 30;
    const columnsCount = Math.ceil(config.totalQuestions / questionsPerColumn);
    const choiceKeys = CHOICE_KEYS_ABCD.slice(0, config.choicesCount);

    const theme: AnswerSheetThemeColor = config.themeColor || 'slate';

    // Minimal and clean theme accents
    const themeStyles = {
      slate: {
        border: 'border-slate-800',
        textPrimary: 'text-slate-900',
        bubbleBorder: 'border-slate-700',
        bubbleText: 'text-slate-800',
        headerLine: 'border-slate-800',
        badgeBg: 'bg-slate-100 text-slate-800',
      },
      navy: {
        border: 'border-blue-900',
        textPrimary: 'text-blue-900',
        bubbleBorder: 'border-blue-900',
        bubbleText: 'text-blue-900',
        headerLine: 'border-blue-900',
        badgeBg: 'bg-blue-50 text-blue-900',
      },
      burgundy: {
        border: 'border-[#701a2b]',
        textPrimary: 'text-[#701a2b]',
        bubbleBorder: 'border-[#701a2b]',
        bubbleText: 'text-[#701a2b]',
        headerLine: 'border-[#701a2b]',
        badgeBg: 'bg-rose-50 text-[#701a2b]',
      },
      emerald: {
        border: 'border-emerald-900',
        textPrimary: 'text-emerald-900',
        bubbleBorder: 'border-emerald-900',
        bubbleText: 'text-emerald-900',
        headerLine: 'border-emerald-900',
        badgeBg: 'bg-emerald-50 text-emerald-900',
      },
    }[theme] || {
      border: 'border-slate-800',
      textPrimary: 'text-slate-900',
      bubbleBorder: 'border-slate-700',
      bubbleText: 'text-slate-800',
      headerLine: 'border-slate-800',
      badgeBg: 'bg-slate-100 text-slate-800',
    };

    const renderSheetInstance = (instanceKey: string) => (
      <div
        key={instanceKey}
        className="relative mx-auto flex flex-col justify-between bg-white p-7 text-slate-900 print:m-0 print:p-6"
        style={{
          width: '210mm',
          minHeight: config.layout === 'eco_half' ? '142mm' : '290mm',
          maxHeight: config.layout === 'eco_half' ? '146mm' : '296mm',
          boxSizing: 'border-box',
          pageBreakInside: 'avoid',
          fontFamily: "'Anuphan', 'Noto Sans Thai', -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        {/* 4 Precision Fiducial Corner Registration Squares for OMR Vision */}
        <div className="absolute left-4 top-4 h-5 w-5 bg-black" />
        <div className="absolute right-4 top-4 h-5 w-5 bg-black" />
        <div className="absolute bottom-4 left-4 h-5 w-5 bg-black" />
        <div className="absolute bottom-4 right-4 h-5 w-5 bg-black" />

        {/* --- 1. CLEAN & UNCLUTTERED HEADER --- */}
        <div className="mx-2">
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3">
            <div>
              <p className="text-[11px] font-semibold tracking-wide text-slate-500">
                {schoolName}
              </p>
              <h1 className={`text-xl font-black tracking-tight ${themeStyles.textPrimary}`}>
                {config.title || 'กระดาษคำตอบ (Answer Sheet)'}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                <span>
                  วิชา: <strong className="text-slate-900">{config.subjectName || '-'}</strong>
                </span>
                {config.roomName && (
                  <span>
                    ชั้น/ห้อง: <strong className="text-slate-900">{config.roomName}</strong>
                  </span>
                )}
                {config.examDate && (
                  <span>
                    วันที่: <strong className="text-slate-900">{config.examDate}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Quick Metadata Badges */}
            <div className="flex items-center gap-2 text-right">
              {config.examSet && (
                <div className="rounded-lg border border-slate-300 px-2.5 py-1 text-center">
                  <div className="text-[9px] text-slate-400 font-bold uppercase">ชุดที่</div>
                  <div className="font-mono text-sm font-black text-slate-900">{config.examSet}</div>
                </div>
              )}
              <div className="rounded-lg border border-slate-300 px-2.5 py-1 text-center">
                <div className="text-[9px] text-slate-400 font-bold uppercase">จำนวน</div>
                <div className="font-mono text-sm font-black text-slate-900">{config.totalQuestions} ข้อ</div>
              </div>
              <div className="rounded-lg border border-slate-300 px-2.5 py-1 text-center">
                <div className="text-[9px] text-slate-400 font-bold uppercase">เต็ม</div>
                <div className="font-mono text-sm font-black text-slate-900">{config.totalScore} คะแนน</div>
              </div>
            </div>
          </div>

          {/* Student Info & Compact Roll Number Bar */}
          <div className="mt-3 flex items-center justify-between gap-6 text-xs">
            {/* Left: Personal Fields with Clear Dotted Underlines */}
            <div className="flex-1 space-y-2.5">
              <div className="flex items-baseline gap-2">
                <span className="font-bold text-slate-700 whitespace-nowrap">ชื่อ - สกุล:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 pb-0.5 font-bold text-slate-900 text-sm">
                  {studentName || ''}
                </span>
              </div>

              <div className="flex items-baseline gap-6">
                <div className="flex items-baseline gap-2 flex-1">
                  <span className="font-bold text-slate-700 whitespace-nowrap">ชั้น / ห้อง:</span>
                  <span className="flex-1 border-b border-dotted border-slate-400 pb-0.5 font-semibold text-slate-800">
                    {config.roomName || ''}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-bold text-slate-700 whitespace-nowrap">เลขที่:</span>
                  <span className="w-16 border-b border-dotted border-slate-400 pb-0.5 text-center font-mono font-bold text-slate-900 text-sm">
                    {rollNumber ? String(rollNumber).padStart(2, '0') : ''}
                  </span>
                </div>
              </div>

              {/* Simple & Clear Instruction */}
              <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-0.5">
                <span>
                  คำชี้แจง: ใช้ดินสอดำ <strong>2B</strong> ฝนในวงกลมให้ดำเต็มวง
                </span>
                <span className="inline-flex items-center gap-1 font-bold text-slate-700">
                  <span className="inline-block h-3.5 w-3.5 rounded-full bg-slate-900 text-[8px] text-white text-center leading-3.5">
                    ●
                  </span>
                  ถูก
                </span>
                <span className="inline-flex items-center gap-1 text-slate-400">
                  <span className="inline-block h-3.5 w-3.5 rounded-full border border-slate-400 text-[8px] text-center leading-3">
                    ✕
                  </span>
                  ผิด
                </span>
              </div>
            </div>

            {/* Right: Roll Number Bubble Box (Compact & Clean) */}
            {config.studentIdFormat === 'roll_number' && (
              <div className="rounded-xl border border-slate-300 bg-slate-50/60 p-2 text-center">
                <div className="text-[10px] font-bold text-slate-600 mb-1">เลขที่ (00-99)</div>
                <div className="flex justify-center gap-3">
                  {['สิบ', 'หน่วย'].map((lbl, cIdx) => (
                    <div key={lbl} className="flex flex-col items-center">
                      <span className="text-[8px] text-slate-400 mb-0.5">{lbl}</span>
                      <div className="h-4 w-5 mb-1 rounded border border-slate-300 bg-white text-center font-mono text-[10px] font-bold leading-4">
                        {rollNumber ? (cIdx === 0 ? Math.floor(rollNumber / 10) : rollNumber % 10) : ''}
                      </div>
                      <div className="space-y-0.5">
                        {Array.from({ length: 10 }).map((_, digit) => (
                          <div
                            key={digit}
                            className={`flex h-3 w-3 items-center justify-center rounded-full border ${themeStyles.bubbleBorder} text-[7px] font-bold ${themeStyles.bubbleText}`}
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
              <div className="rounded-xl border border-slate-300 bg-slate-50/60 p-2 text-center">
                <div className="text-[10px] font-bold text-slate-600 mb-1">รหัสประจำตัว (5 หลัก)</div>
                <div className="flex justify-center gap-1.5">
                  {Array.from({ length: 5 }).map((_, colIndex) => (
                    <div key={colIndex} className="flex flex-col items-center">
                      <div className="h-4 w-4 mb-1 rounded border border-slate-300 bg-white text-center font-mono text-[9px] font-bold leading-4" />
                      <div className="space-y-0.5">
                        {Array.from({ length: 10 }).map((_, digit) => (
                          <div
                            key={digit}
                            className={`flex h-2.5 w-2.5 items-center justify-center rounded-full border ${themeStyles.bubbleBorder} text-[6.5px] font-bold ${themeStyles.bubbleText}`}
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

        {/* --- 2. CLEAN & SPACIOUS ANSWER GRID --- */}
        <div
          className="my-4 mx-2 flex-1 grid gap-4"
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
                className="flex flex-col rounded-xl border border-slate-300 bg-white p-2.5 text-xs shadow-2xs"
              >
                {/* Column Column Header */}
                <div className="mb-2 flex items-center justify-between border-b border-slate-200 pb-1.5 font-bold text-slate-700">
                  <span className="w-7 text-center font-mono text-xs">ข้อ</span>
                  <div className="flex gap-2.5">
                    {choiceKeys.map((_, i) => (
                      <span key={i} className="w-5 text-center font-bold text-xs text-slate-600">
                        {getChoiceLabel(i, config.choiceLabelType)}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Questions List with whitespace group every 5 questions (no loud colors) */}
                <div className="flex-1 space-y-1">
                  {questions.map((q) => {
                    const isFifthBreak = q % 5 === 0 && q !== endQ;

                    return (
                      <div key={q} className={isFifthBreak ? 'mb-2.5' : ''}>
                        <div className="flex items-center justify-between py-0.5">
                          <span className="w-7 text-right font-mono text-xs font-bold text-slate-700">
                            {q}.
                          </span>

                          <div className="flex gap-2.5">
                            {choiceKeys.map((_, cIdx) => (
                              <div
                                key={cIdx}
                                className={`flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] ${themeStyles.bubbleBorder} text-[10px] font-black ${themeStyles.bubbleText} bg-white transition hover:bg-slate-100`}
                              >
                                {getChoiceLabel(cIdx, config.choiceLabelType)}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Subtle hairline after every 5th question */}
                        {isFifthBreak && (
                          <div className="my-1 border-b border-slate-100" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* --- 3. CLEAN & MINIMAL FOOTER --- */}
        <div className="mx-2 flex items-center justify-between border-t border-slate-300 pt-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-500">
              ClassCare 360 AI OMR System
            </span>
          </div>

          {/* Teacher Score Box */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">คะแนนที่ได้ (Score):</span>
            <div className="h-7 w-20 rounded-md border border-slate-400 bg-white" />
            <span className="font-mono font-bold text-slate-800">
              / {config.totalScore}
            </span>
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
          <div className="mt-4 print:mt-4 print:pt-4 print:border-t-2 print:border-dashed print:border-slate-300">
            {renderSheetInstance('instance-2')}
          </div>
        )}
      </div>
    );
  }
);

PrintableAnswerSheet.displayName = 'PrintableAnswerSheet';
