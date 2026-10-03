import { forwardRef } from 'react';
import type { AnswerSheetConfig } from '../../types/omr';
import { CHOICE_KEYS_ABCD, getChoiceLabel } from '../../lib/omrEngine';

interface PrintableAnswerSheetProps {
  config: AnswerSheetConfig;
  schoolName?: string;
  studentName?: string;
  rollNumber?: number;
}

export const PrintableAnswerSheet = forwardRef<HTMLDivElement, PrintableAnswerSheetProps>(
  ({ config, schoolName = 'ClassCare 360 Smart Academy', studentName, rollNumber }, ref) => {
    const questionsPerColumn = config.totalQuestions <= 30 ? 15 : config.totalQuestions <= 60 ? 25 : 35;
    const columnsCount = Math.ceil(config.totalQuestions / questionsPerColumn);
    const choiceKeys = CHOICE_KEYS_ABCD.slice(0, config.choicesCount);

    const renderSheetInstance = (instanceKey: string) => (
      <div
        key={instanceKey}
        className="relative mx-auto flex flex-col justify-between border-2 border-slate-900 bg-white p-6 shadow-sm print:m-0 print:border-2 print:border-black print:p-5 print:shadow-none"
        style={{
          width: '210mm',
          minHeight: config.layout === 'eco_half' ? '142mm' : '290mm',
          maxHeight: config.layout === 'eco_half' ? '146mm' : '296mm',
          boxSizing: 'border-box',
          pageBreakInside: 'avoid',
        }}
      >
        {/* 4 Corner Markers for OMR Computer Vision Registration */}
        <div className="absolute left-2.5 top-2.5 h-6 w-6 bg-slate-950 print:bg-black" aria-hidden="true" />
        <div className="absolute right-2.5 top-2.5 h-6 w-6 bg-slate-950 print:bg-black" aria-hidden="true" />
        <div className="absolute bottom-2.5 left-2.5 h-6 w-6 bg-slate-950 print:bg-black" aria-hidden="true" />
        <div className="absolute bottom-2.5 right-2.5 h-6 w-6 bg-slate-950 print:bg-black" aria-hidden="true" />

        {/* Top Header */}
        <div className="border-b-2 border-slate-900 pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 print:text-black">
                {schoolName} • OMR ANSWER SHEET
              </p>
              <h1 className="text-xl font-black text-slate-950 print:text-black">{config.title || 'แบบทดสอบ'}</h1>
              <p className="text-xs font-semibold text-slate-700 print:text-black">
                วิชา: <span className="font-bold">{config.subjectName || '-'}</span> | วันที่สอบ:{' '}
                <span className="font-bold">{config.examDate || '-'}</span> | จำนวน:{' '}
                <span className="font-bold">{config.totalQuestions} ข้อ</span> ({config.totalScore} คะแนน)
              </p>
            </div>

            {/* Exam Badge / QR placeholder */}
            <div className="flex flex-col items-end text-right">
              <div className="rounded border border-slate-800 bg-slate-50 px-2.5 py-1 text-center font-mono text-xs font-black print:border-black print:bg-white">
                FORM: {config.totalQuestions}Q-{config.choicesCount}C
              </div>
              <p className="mt-1 text-[10px] text-slate-500 print:text-black">ClassCare 360 Vision OMR</p>
            </div>
          </div>

          {/* Student Info & Instruction Row */}
          <div className="mt-3 grid grid-cols-12 gap-3 pt-2 text-xs">
            <div className="col-span-8 flex flex-col justify-between space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900">ชื่อ - สกุล:</span>
                <div className="flex-1 border-b border-dotted border-slate-400 pb-0.5 font-medium">
                  {studentName || ''}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">ชั้น:</span>
                  <div className="w-20 border-b border-dotted border-slate-400 pb-0.5"></div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">เลขที่:</span>
                  <div className="w-16 border-b border-dotted border-slate-400 pb-0.5 text-center font-mono font-bold">
                    {rollNumber ? String(rollNumber).padStart(2, '0') : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">ห้อง:</span>
                  <div className="w-16 border-b border-dotted border-slate-400 pb-0.5"></div>
                </div>
              </div>
              <div className="rounded bg-slate-100 p-2 text-[10.5px] leading-relaxed text-slate-700 print:border print:border-slate-300 print:bg-slate-50">
                <span className="font-bold text-slate-900">คำชี้แจง:</span> ใช้ดินสอ 2B
                ฝนทับวงกลมตัวเลือกที่ต้องการให้เข้มเต็มวง [ ● ] หากต้องการเปลี่ยนคำตอบให้ใช้ยางลบลบให้สะอาดหมดจด
              </div>
            </div>

            {/* Roll Number Bubble Grid */}
            {config.studentIdFormat === 'roll_number' && (
              <div className="col-span-4 rounded border border-slate-800 p-1.5 print:border-black">
                <div className="border-b border-slate-300 pb-1 text-center font-bold text-[11px] text-slate-900">
                  ฝนเลขที่ (00 - 99)
                </div>
                <div className="mt-1 flex justify-center gap-4">
                  {['สิบ', 'หน่วย'].map((colLabel, cIdx) => (
                    <div key={colLabel} className="flex flex-col items-center">
                      <span className="text-[9.5px] font-bold text-slate-500">{colLabel}</span>
                      <div className="mt-0.5 space-y-0.5">
                        {Array.from({ length: 10 }).map((_, digit) => (
                          <div
                            key={digit}
                            className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-600 text-[9px] font-bold text-slate-700 print:border-black"
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

        {/* Bubble Questions Grid */}
        <div
          className="my-3 flex-1 grid gap-4"
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
                className="rounded border border-slate-200 p-2 text-xs print:border print:border-slate-300"
              >
                <div className="mb-2 flex items-center justify-between border-b border-slate-200 pb-1 text-[11px] font-bold text-slate-600 print:text-black">
                  <span>ข้อ</span>
                  <div className="flex gap-2">
                    {choiceKeys.map((_, i) => (
                      <span key={i} className="w-5 text-center">
                        {getChoiceLabel(i, config.choiceLabelType)}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  {questions.map((q) => (
                    <div key={q} className="flex items-center justify-between py-0.5">
                      <span className="w-6 text-right font-mono font-bold text-slate-800 print:text-black">{q}.</span>
                      <div className="flex gap-2">
                        {choiceKeys.map((_, cIdx) => (
                          <div
                            key={cIdx}
                            className="flex h-5 w-5 items-center justify-center rounded-full border-1.5 border-slate-600 text-[10px] font-bold text-slate-800 print:border print:border-black print:text-black"
                          >
                            {getChoiceLabel(cIdx, config.choiceLabelType)}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Score Marking Block */}
        <div className="flex items-center justify-between border-t-2 border-slate-900 pt-2 text-[10px] text-slate-600 print:text-black">
          <div>ระบบตรวจกระดาษคำตอบ ClassCare 360 AI Vision OMR • คมชัด แม่นยำ รวดเร็ว</div>
          <div className="flex items-center gap-2">
            <span className="font-bold">คะแนนที่ได้:</span>
            <div className="h-6 w-20 rounded border border-slate-400 bg-slate-50 print:bg-white" />
            <span className="font-bold">/ {config.totalScore} คะแนน</span>
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
                margin: 6mm;
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
