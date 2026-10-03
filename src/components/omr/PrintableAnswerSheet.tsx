import { forwardRef } from 'react';
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

    const theme: AnswerSheetThemeColor = config.themeColor || 'slate';

    const themeStyles = {
      slate: {
        border: 'border-slate-800',
        textPrimary: 'text-slate-900',
        bubbleBorder: 'border-slate-800',
        bubbleText: 'text-slate-800',
      },
      navy: {
        border: 'border-blue-900',
        textPrimary: 'text-blue-900',
        bubbleBorder: 'border-blue-900',
        bubbleText: 'text-blue-900',
      },
      burgundy: {
        border: 'border-[#701a2b]',
        textPrimary: 'text-[#701a2b]',
        bubbleBorder: 'border-[#701a2b]',
        bubbleText: 'text-[#701a2b]',
      },
      emerald: {
        border: 'border-emerald-900',
        textPrimary: 'text-emerald-900',
        bubbleBorder: 'border-emerald-900',
        bubbleText: 'text-emerald-900',
      },
    }[theme] || {
      border: 'border-slate-800',
      textPrimary: 'text-slate-900',
      bubbleBorder: 'border-slate-800',
      bubbleText: 'text-slate-800',
    };

    const isDense = !isEcoHalf && (columnsCount >= 4 || (columnsCount >= 3 && config.choicesCount >= 5));

    const renderSheetInstance = (instanceKey: string) => (
      <div
        key={instanceKey}
        className={`relative flex flex-col justify-between bg-white text-slate-900 ${
          isEcoHalf ? 'p-4' : 'p-6'
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
        {/* 4 Precision Fiducial Corner Registration Targets for OMR AI Vision */}
        <div
          className={`absolute left-3 top-3 bg-black ${isEcoHalf ? 'h-3.5 w-3.5' : 'h-4 w-4'}`}
        />
        <div
          className={`absolute right-3 top-3 bg-black ${isEcoHalf ? 'h-3.5 w-3.5' : 'h-4 w-4'}`}
        />
        <div
          className={`absolute bottom-3 left-3 bg-black ${isEcoHalf ? 'h-3.5 w-3.5' : 'h-4 w-4'}`}
        />
        <div
          className={`absolute bottom-3 right-3 bg-black ${isEcoHalf ? 'h-3.5 w-3.5' : 'h-4 w-4'}`}
        />

        {/* --- 1. CLEAN HEADER & METADATA --- */}
        <div className="mx-2">
          <div className={`flex items-start justify-between border-b-2 border-slate-900 ${isEcoHalf ? 'pb-1.5' : 'pb-2.5'}`}>
            <div>
              <p className="text-[10px] font-semibold tracking-wide text-slate-500">
                {schoolName}
              </p>
              <h1 className={`font-black tracking-tight ${themeStyles.textPrimary} ${isEcoHalf ? 'text-base leading-tight' : 'text-xl'}`}>
                {config.title || 'กระดาษคำตอบ (Answer Sheet)'}
              </h1>
              <div className={`mt-0.5 flex flex-wrap items-center gap-2.5 text-slate-600 ${isEcoHalf ? 'text-[10px]' : 'text-xs'}`}>
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

            {/* Quick Metadata Box */}
            <div className="flex items-center gap-1.5 text-right">
              {config.examSet && (
                <div className="rounded border border-slate-300 px-2 py-0.5 text-center">
                  <div className="text-[8px] text-slate-400 font-bold uppercase">ชุด</div>
                  <div className="font-mono text-xs font-black text-slate-900">{config.examSet}</div>
                </div>
              )}
              <div className="rounded border border-slate-300 px-2 py-0.5 text-center">
                <div className="text-[8px] text-slate-400 font-bold uppercase">จำนวน</div>
                <div className="font-mono text-xs font-black text-slate-900">{config.totalQuestions} ข้อ</div>
              </div>
              <div className="rounded border border-slate-300 px-2 py-0.5 text-center">
                <div className="text-[8px] text-slate-400 font-bold uppercase">เต็ม</div>
                <div className="font-mono text-xs font-black text-slate-900">{config.totalScore} คะแนน</div>
              </div>
            </div>
          </div>

          {/* Student Info Bar & Roll Number Box */}
          <div className={`flex items-center justify-between gap-4 text-xs ${isEcoHalf ? 'mt-1.5' : 'mt-2.5'}`}>
            <div className={`flex-1 ${isEcoHalf ? 'space-y-1' : 'space-y-2'}`}>
              <div className="flex items-baseline gap-2">
                <span className="font-bold text-slate-700 whitespace-nowrap text-[11px]">ชื่อ - สกุล:</span>
                <span className="flex-1 border-b border-dotted border-slate-400 pb-0.5 font-bold text-slate-900 text-xs">
                  {studentName || ''}
                </span>
              </div>

              <div className="flex items-baseline gap-4">
                <div className="flex items-baseline gap-2 flex-1">
                  <span className="font-bold text-slate-700 whitespace-nowrap text-[11px]">ชั้น / ห้อง:</span>
                  <span className="flex-1 border-b border-dotted border-slate-400 pb-0.5 font-semibold text-slate-800 text-xs">
                    {config.roomName || ''}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-bold text-slate-700 whitespace-nowrap text-[11px]">เลขที่:</span>
                  <span className="w-14 border-b border-dotted border-slate-400 pb-0.5 text-center font-mono font-bold text-slate-900 text-xs">
                    {rollNumber ? String(rollNumber).padStart(2, '0') : ''}
                  </span>
                </div>
              </div>

              {/* Instructions */}
              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                <span>
                  คำชี้แจง: ใช้ดินสอดำ <strong>2B</strong> ฝนให้ดำเต็มวง
                </span>
                <span className="inline-flex items-center gap-0.5 font-bold text-slate-700">
                  <span className="inline-block h-3 w-3 rounded-full bg-slate-900 text-[7px] text-white text-center leading-3">
                    ●
                  </span>
                  ถูก
                </span>
                <span className="inline-flex items-center gap-0.5 text-slate-400">
                  <span className="inline-block h-3 w-3 rounded-full border border-slate-400 text-[7px] text-center leading-2.5">
                    ✕
                  </span>
                  ผิด
                </span>
              </div>
            </div>

            {/* Roll Number Bubble Grid */}
            {config.studentIdFormat === 'roll_number' && (
              <div className={`rounded-lg border border-slate-300 bg-slate-50/70 text-center ${isEcoHalf ? 'p-1' : 'p-1.5'}`}>
                <div className="text-[9px] font-bold text-slate-600 mb-0.5">เลขที่ (00-99)</div>
                <div className="flex justify-center gap-2.5">
                  {['สิบ', 'หน่วย'].map((lbl, cIdx) => (
                    <div key={lbl} className="flex flex-col items-center">
                      <span className="text-[7.5px] text-slate-400 mb-0.5">{lbl}</span>
                      <div className="h-3.5 w-4 mb-0.5 rounded border border-slate-300 bg-white text-center font-mono text-[9px] font-bold leading-3.5">
                        {rollNumber ? (cIdx === 0 ? Math.floor(rollNumber / 10) : rollNumber % 10) : ''}
                      </div>
                      <div className="space-y-0.5">
                        {Array.from({ length: 10 }).map((_, digit) => (
                          <div
                            key={digit}
                            className={`flex items-center justify-center rounded-full border ${themeStyles.bubbleBorder} font-bold ${themeStyles.bubbleText} ${
                              isEcoHalf ? 'h-2.5 w-2.5 text-[6px]' : 'h-3 w-3 text-[7px]'
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

            {/* Student Code 5-Digit Bubble Grid */}
            {config.studentIdFormat === 'student_code' && (
              <div className={`rounded-lg border border-slate-300 bg-slate-50/70 text-center ${isEcoHalf ? 'p-1' : 'p-1.5'}`}>
                <div className="text-[9px] font-bold text-slate-600 mb-0.5">รหัสประจำตัว (5 หลัก)</div>
                <div className="flex justify-center gap-1.5">
                  {['1', '2', '3', '4', '5'].map((colNum) => (
                    <div key={colNum} className="flex flex-col items-center">
                      <span className="text-[7.5px] text-slate-400 mb-0.5">{colNum}</span>
                      <div className="h-3.5 w-3.5 mb-0.5 rounded border border-slate-300 bg-white text-center font-mono text-[9px] font-bold leading-3.5" />
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

        {/* --- 2. CLEAN & PROPORTIONATE QUESTIONS ANSWER GRID --- */}
        <div
          className={`mx-auto flex-1 grid gap-3 ${isEcoHalf ? 'my-1.5' : 'my-2.5'} w-full`}
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
                className={`flex flex-col rounded-lg border border-slate-300 bg-white ${
                  isEcoHalf || isDense ? 'p-1.5' : 'p-2'
                }`}
              >
                {/* Column Header - Compact natural spacing aligned with choices */}
                <div className={`flex items-center justify-center border-b border-slate-200 font-bold text-slate-700 ${
                  isEcoHalf
                    ? 'mb-1 pb-1 text-[10px] gap-2'
                    : isDense
                    ? 'mb-1 pb-1 text-[11px] gap-2'
                    : 'mb-1.5 pb-1 text-xs gap-2.5'
                }`}>
                  <span className={`text-center font-bold text-slate-700 ${
                    isEcoHalf || isDense ? 'w-6 text-[10px]' : 'w-7 text-xs'
                  }`}>
                    ข้อ
                  </span>
                  <div className={`flex ${isEcoHalf || isDense ? 'gap-1.5' : 'gap-2'}`}>
                    {choiceKeys.map((_, i) => (
                      <span
                        key={i}
                        className={`text-center font-bold text-slate-600 ${
                          isEcoHalf || isDense ? 'w-4 text-[10px]' : 'w-5 text-xs'
                        }`}
                      >
                        {getChoiceLabel(i, config.choiceLabelType)}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Question rows with whitespace every 5 questions */}
                <div className="flex-1 space-y-0.5">
                  {questions.map((q) => {
                    const isFifthBreak = q % 5 === 0 && q !== endQ;

                    return (
                      <div key={q} className={isFifthBreak ? (isEcoHalf ? 'mb-1.5' : 'mb-2') : ''}>
                        <div className={`flex items-center justify-center ${
                          isEcoHalf || isDense ? 'gap-2' : 'gap-2.5'
                        } py-0.2`}>
                          <span className={`text-right font-mono font-bold text-slate-700 pr-0.5 ${
                            isEcoHalf || isDense ? 'w-6 text-[10px]' : 'w-7 text-[11px]'
                          }`}>
                            {q}.
                          </span>

                          <div className={`flex ${isEcoHalf || isDense ? 'gap-1.5' : 'gap-2'}`}>
                            {choiceKeys.map((_, cIdx) => (
                              <div
                                key={cIdx}
                                className={`flex items-center justify-center rounded-full border-[1.5px] ${themeStyles.bubbleBorder} font-black ${themeStyles.bubbleText} bg-white ${
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

                        {/* Subtle divider after each 5 questions */}
                        {isFifthBreak && (
                          <div className="my-0.5 border-b border-slate-100" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* --- 3. CLEAN COMPACT FOOTER --- */}
        <div className={`mx-2 flex items-center justify-between border-t border-slate-300 ${
          isEcoHalf ? 'pt-1.5 text-[10px]' : 'pt-2 text-xs'
        } text-slate-600`}>
          <span className="font-semibold text-slate-500">
            ClassCare 360 AI OMR System
          </span>

          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-700">คะแนนที่ได้ (Score):</span>
            <div className={`rounded border border-slate-400 bg-white ${
              isEcoHalf ? 'h-5 w-14' : 'h-6 w-16'
            }`} />
            <span className="font-mono font-bold text-slate-800">
              / {config.totalScore}
            </span>
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
