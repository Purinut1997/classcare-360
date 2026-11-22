import { forwardRef, useMemo } from 'react';
import QRCode from 'qrcode';
import type { AnswerSheetConfig, AnswerSheetThemeColor } from '../../types/omr';
import { CHOICE_KEYS_ABCD, getChoiceLabel } from '../../lib/omrEngine';
import { getUnifiedSheetGeometry } from '../../lib/omrGeometry';

export interface PrintableStudentTarget {
  id: string;
  first_name: string;
  last_name: string;
  student_code: string;
  rollNumber?: number;
}

interface PrintableAnswerSheetProps {
  config: AnswerSheetConfig;
  schoolName?: string;
  isMiniPreview?: boolean;
  batchStudents?: PrintableStudentTarget[];
}

const THEME_PALETTE: Record<
  AnswerSheetThemeColor,
  { accent: string; soft: string; border: string; badgeText: string }
> = {
  burgundy: { accent: '#881337', soft: '#fff1f2', border: '#fda4af', badgeText: '#881337' },
  navy: { accent: '#1e3a8a', soft: '#eff6ff', border: '#93c5fd', badgeText: '#1e3a8a' },
  emerald: { accent: '#065f46', soft: '#ecfdf5', border: '#6ee7b7', badgeText: '#065f46' },
  slate: { accent: '#0f172a', soft: '#f8fafc', border: '#cbd5e1', badgeText: '#0f172a' },
};

function buildQrSvgPath(payload: string, x: number, y: number, size: number): { d: string } {
  try {
    const qr = QRCode.create(payload, { errorCorrectionLevel: 'M' });
    const count = qr.modules.size;
    const quiet = 6;
    const cell = (size - quiet * 2) / count;
    const cs = cell.toFixed(2);
    const parts: string[] = [];

    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.modules.get(r, c)) {
          const mx = (x + quiet + c * cell).toFixed(2);
          const my = (y + quiet + r * cell).toFixed(2);
          parts.push(`M${mx},${my}h${cs}v${cs}h-${cs}z`);
        }
      }
    }
    return { d: parts.join('') };
  } catch {
    return { d: '' };
  }
}

function truncateText(text: string, maxLen: number): string {
  if (!text) return '';
  return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text;
}

function SingleAnswerSheetSvg({
  config,
  schoolName,
  prefilledStudent,
}: {
  config: AnswerSheetConfig;
  schoolName?: string;
  prefilledStudent?: PrintableStudentTarget;
}) {
  const geometry = useMemo(() => getUnifiedSheetGeometry(config), [config]);
  const theme = THEME_PALETTE[config.themeColor || 'slate'] || THEME_PALETTE.slate;
  const isHalf = geometry.layout === 'eco_half';
  const examSet = config.examSet || '01';
  const choiceKeys = CHOICE_KEYS_ABCD.slice(0, config.choicesCount);

  const rollNum = prefilledStudent?.rollNumber ?? null;
  const prefillDigits = useMemo(() => {
    if (!prefilledStudent || config.studentIdFormat === 'none') return null;
    if (config.studentIdFormat === 'student_code') {
      const cleaned = (prefilledStudent.student_code || '').replace(/\D/g, '');
      return cleaned.padStart(5, '0').slice(-5);
    }
    if (rollNum !== null) {
      return String(Math.max(1, Math.min(99, rollNum))).padStart(2, '0');
    }
    return null;
  }, [prefilledStudent, config.studentIdFormat, rollNum]);

  const qrPath = useMemo(() => {
    if (config.showQrCode === false) return '';
    const payload = JSON.stringify({
      app: 'CC360',
      id: config.id || 'draft',
      set: examSet,
      tq: config.totalQuestions,
      ...(prefilledStudent
        ? {
            sid: prefilledStudent.id,
            ...(rollNum !== null ? { roll: rollNum } : {}),
            ...(prefilledStudent.student_code ? { code: prefilledStudent.student_code } : {}),
          }
        : {}),
    });
    return buildQrSvgPath(payload, geometry.qrBox.x, geometry.qrBox.y, geometry.qrBox.width).d;
  }, [config.showQrCode, config.id, config.totalQuestions, examSet, prefilledStudent, rollNum, geometry.qrBox]);

  // Partition answerRows by column for drawing column boxes & headers
  const columnGroups = useMemo(() => {
    const cols: Array<{ colIndex: number; rows: typeof geometry.answerRows }> = [];
    for (let c = 0; c < geometry.answerCols; c++) {
      cols.push({
        colIndex: c,
        rows: geometry.answerRows.filter((r) => r.columnIndex === c),
      });
    }
    return cols;
  }, [geometry.answerRows, geometry.answerCols]);

  const { fiducials, orientationAnchor, headerBox, qrBox, scoreBox } = geometry;
  const gridTop = isHalf ? 242 : 320;
  const gridLeft = 44;
  const colWidth = 912 / geometry.answerCols;
  const effectiveSchool = config.schoolName || schoolName || 'ClassCare 360 School';
  const studentLine = prefilledStudent
    ? `${rollNum !== null ? `เลขที่ ${String(rollNum).padStart(2, '0')} • ` : ''}${prefilledStudent.first_name} ${prefilledStudent.last_name}`.trim()
    : '';

  return (
    <svg
      viewBox={`0 0 ${geometry.width} ${geometry.height}`}
      className="block w-full h-auto bg-white select-none"
      style={{ fontFamily: "'Anuphan', 'Sarabun', system-ui, sans-serif" }}
    >
      {/* Pure white background */}
      <rect x="0" y="0" width={geometry.width} height={geometry.height} fill="#ffffff" />

      {/* 4 Concentric Fiducial Targets (Corner Registration Marks) */}
      {[fiducials.tl, fiducials.tr, fiducials.br, fiducials.bl].map((f) => (
        <g key={f.id}>
          <circle cx={f.cx} cy={f.cy} r={f.outerRadius} fill="#0f172a" />
          <circle cx={f.cx} cy={f.cy} r={f.midWhiteRadius} fill="#ffffff" />
          <circle cx={f.cx} cy={f.cy} r={f.innerRadius} fill="#0f172a" />
        </g>
      ))}

      {/* Asymmetric Top-Left Orientation Anchor ONLY (TR/BR/BL probe spots remain pure white) */}
      <circle
        cx={orientationAnchor.cx}
        cy={orientationAnchor.cy}
        r={orientationAnchor.r}
        fill="#0f172a"
      />

      {/* Top Center Banner */}
      <text
        x={geometry.width / 2}
        y={fiducials.tl.cy + 5}
        textAnchor="middle"
        fontSize={isHalf ? 15 : 17}
        fontWeight="800"
        fill={theme.accent}
      >
        {truncateText(`${effectiveSchool} • กระดาษคำตอบ OMR`, 58)}
      </text>

      {/* Header Frame */}
      <rect
        x={headerBox.x}
        y={headerBox.y}
        width={headerBox.width}
        height={headerBox.height}
        rx="10"
        fill="#ffffff"
        stroke={theme.accent}
        strokeWidth="1.8"
      />

      {/* Left Column: Exam Info & Student Name */}
      <text
        x={headerBox.x + 16}
        y={headerBox.y + (isHalf ? 24 : 30)}
        fontSize={isHalf ? 14 : 16}
        fontWeight="800"
        fill="#0f172a"
      >
        {truncateText(config.title || 'แบบทดสอบวัดผลสัมฤทธิ์', isHalf ? 30 : 34)}
      </text>

      <text
        x={headerBox.x + 16}
        y={headerBox.y + (isHalf ? 45 : 54)}
        fontSize={isHalf ? 11.5 : 13}
        fontWeight="700"
        fill="#334155"
      >
        {truncateText(
          `วิชา: ${config.subjectName || '-'} • ${
            config.isUniversalRoom ? 'รวมทุกห้อง' : config.roomName || 'ห้องเรียน'
          } (เทอม ${config.term || '1'}/${config.academicYear || '2568'})`,
          isHalf ? 44 : 48
        )}
      </text>

      {/* Student Name Box */}
      <rect
        x={headerBox.x + 14}
        y={headerBox.y + (isHalf ? 56 : 68)}
        width={isHalf ? 326 : 338}
        height={isHalf ? 42 : 76}
        rx="6"
        fill={prefilledStudent ? theme.soft : '#f8fafc'}
        stroke={theme.border}
        strokeWidth="1"
      />

      {prefilledStudent ? (
        <>
          <text
            x={headerBox.x + 24}
            y={headerBox.y + (isHalf ? 74 : 92)}
            fontSize={isHalf ? 11 : 12}
            fontWeight="700"
            fill={theme.badgeText}
          >
            ผู้เข้าสอบ (พิมพ์รหัสประจำตัวอัตโนมัติ)
          </text>
          <text
            x={headerBox.x + 24}
            y={headerBox.y + (isHalf ? 92 : 118)}
            fontSize={isHalf ? 13 : 15}
            fontWeight="800"
            fill="#0f172a"
          >
            {truncateText(studentLine, 34)}
          </text>
          {!isHalf && prefilledStudent.student_code && (
            <text
              x={headerBox.x + 24}
              y={headerBox.y + 136}
              fontSize="11.5"
              fontWeight="600"
              fill="#475569"
            >
              รหัสนักเรียน: {prefilledStudent.student_code} • ชุดข้อสอบ {examSet}
            </text>
          )}
        </>
      ) : (
        <>
          <text
            x={headerBox.x + 22}
            y={headerBox.y + (isHalf ? 74 : 90)}
            fontSize={isHalf ? 11 : 12.5}
            fontWeight="700"
            fill="#334155"
          >
            ชื่อ-นามสกุล ...........................................................
          </text>
          <text
            x={headerBox.x + 22}
            y={headerBox.y + (isHalf ? 92 : 114)}
            fontSize={isHalf ? 11 : 12.5}
            fontWeight="700"
            fill="#334155"
          >
            ชั้น/ห้อง .................. เลขที่ ........... วันที่ {config.examDate || '..../..../....'}
          </text>
          {!isHalf && (
            <text
              x={headerBox.x + 22}
              y={headerBox.y + 136}
              fontSize="10.5"
              fontWeight="600"
              fill="#64748b"
            >
              คำชี้แจง: {truncateText(config.instructions || 'ใช้ดินสอ 2B หรือปากกาดำระบายให้เต็มวงกลม', 46)}
            </text>
          )}
        </>
      )}

      {/* Meta Line & Instructions bottom-left */}
      <text
        x={headerBox.x + 16}
        y={scoreBox.y + 18}
        fontSize={isHalf ? 10.5 : 11.5}
        fontWeight="700"
        fill="#475569"
      >
        จำนวน {config.totalQuestions} ข้อ • ชุด {examSet}
      </text>
      <text
        x={headerBox.x + 16}
        y={scoreBox.y + 34}
        fontSize={isHalf ? 9.5 : 10.5}
        fontWeight="600"
        fill="#64748b"
      >
        {isHalf ? 'ระบายให้เต็มวงกลม ห้ามออกนอกกรอบ' : 'ระบายทึบเต็มวงกลม • ห้ามขีดฆ่า/พับกระดาษ'}
      </text>

      {/* Score Box */}
      <rect
        x={scoreBox.x}
        y={scoreBox.y}
        width={scoreBox.width}
        height={scoreBox.height}
        rx="6"
        fill={theme.soft}
        stroke={theme.accent}
        strokeWidth="1.2"
      />
      <text
        x={scoreBox.x + scoreBox.width / 2}
        y={scoreBox.y + 14}
        textAnchor="middle"
        fontSize="10"
        fontWeight="800"
        fill={theme.badgeText}
      >
        คะแนนที่ได้ (SCORE)
      </text>
      <text
        x={scoreBox.x + scoreBox.width - 10}
        y={scoreBox.y + scoreBox.height - 9}
        textAnchor="end"
        fontSize="13"
        fontWeight="800"
        fill="#334155"
      >
        / {config.totalScore}
      </text>

      {/* Vertical Divider separating Info / Bubbles / QR */}
      <line
        x1={isHalf ? 396 : 374}
        y1={headerBox.y + 8}
        x2={isHalf ? 396 : 374}
        y2={headerBox.y + headerBox.height - 8}
        stroke="#e2e8f0"
        strokeWidth="1.2"
      />

      {/* Exam Set Bubbles ('01'..'04') */}
      <text
        x={geometry.examSetBubbles[0]?.cx ?? 410}
        y={headerBox.y + 20}
        textAnchor="middle"
        fontSize="10.5"
        fontWeight="800"
        fill={theme.accent}
      >
        ชุดสอบ
      </text>
      {geometry.examSetBubbles.map((sb) => {
        const isCurrentSet = sb.setCode === examSet;
        return (
          <g key={sb.setCode}>
            <text
              x={sb.cx - sb.r - 13}
              y={sb.cy + 3.5}
              textAnchor="middle"
              fontSize="10.5"
              fontWeight="700"
              fill="#334155"
            >
              {sb.setCode}
            </text>
            <circle
              cx={sb.cx}
              cy={sb.cy}
              r={sb.r}
              fill={isCurrentSet ? '#111827' : '#ffffff'}
              stroke={isCurrentSet ? '#111827' : '#475569'}
              strokeWidth="1.4"
            />
          </g>
        );
      })}

      {/* Student ID Grid (roll_number 2-digit or student_code 5-digit) */}
      {config.studentIdFormat !== 'none' ? (
        <g>
          <text
            x={
              config.layout === 'eco_half'
                ? 635
                : config.studentIdFormat === 'student_code'
                  ? 568
                  : 554
            }
            y={headerBox.y + 18}
            textAnchor="middle"
            fontSize="10.5"
            fontWeight="800"
            fill={theme.accent}
          >
            {config.studentIdFormat === 'student_code'
              ? 'รหัสประจำตัวนักเรียน 5 หลัก'
              : 'เลขที่นักเรียน (01-99)'}
          </text>

          {geometry.studentIdDigits.map((track, dIdx) => {
            const firstB = track.bubbles[0];
            const prefillDigitVal = prefillDigits ? parseInt(prefillDigits[dIdx] || '', 10) : NaN;
            return (
              <g key={track.digitIndex}>
                {track.orientation === 'horizontal' ? (
                  <text
                    x={firstB.cx - firstB.r - 12}
                    y={firstB.cy + 3.5}
                    textAnchor="end"
                    fontSize="10"
                    fontWeight="700"
                    fill="#334155"
                  >
                    {track.label}
                  </text>
                ) : (
                  <text
                    x={firstB.cx}
                    y={firstB.cy - firstB.r - 7}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="700"
                    fill="#334155"
                  >
                    {track.label}
                  </text>
                )}

                {track.bubbles.map((b) => {
                  const filled = prefillDigitVal === b.digitValue;
                  return (
                    <g key={b.digitValue}>
                      <circle
                        cx={b.cx}
                        cy={b.cy}
                        r={b.r}
                        fill={filled ? '#111827' : '#ffffff'}
                        stroke={filled ? '#111827' : '#475569'}
                        strokeWidth="1.25"
                      />
                      {!filled && (
                        <text
                          x={b.cx}
                          y={b.cy + 3.2}
                          textAnchor="middle"
                          fontSize={b.r * 1.15}
                          fontWeight="700"
                          fill="#94a3b8"
                        >
                          {b.digitValue}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </g>
      ) : (
        <text
          x={isHalf ? 600 : 570}
          y={headerBox.y + headerBox.height / 2 + 4}
          textAnchor="middle"
          fontSize="12"
          fontWeight="700"
          fill="#94a3b8"
        >
          แบบทดสอบไม่ระบุรหัส (Anonymous / Quiz Mode)
        </text>
      )}

      {/* QR Code Area */}
      {config.showQrCode !== false && (
        <g>
          <rect
            x={qrBox.x}
            y={qrBox.y}
            width={qrBox.width}
            height={qrBox.height}
            rx="4"
            fill="#ffffff"
            stroke="#e2e8f0"
            strokeWidth="1"
          />
          {qrPath && <path d={qrPath} fill="#0f172a" />}
          <text
            x={qrBox.x + qrBox.width / 2}
            y={qrBox.y + qrBox.height + 14}
            textAnchor="middle"
            fontSize="9.5"
            fontWeight="800"
            fill="#334155"
          >
            {prefilledStudent && rollNum !== null
              ? `NO.${String(rollNum).padStart(2, '0')} • SET ${examSet}`
              : `QR OMR • SET ${examSet}`}
          </text>
        </g>
      )}

      {/* Answer Bubble Columns */}
      {columnGroups.map((col) => {
        if (col.rows.length === 0) return null;
        const colX = gridLeft + col.colIndex * colWidth + 4;
        const boxW = colWidth - 8;
        const lastRowY = col.rows[col.rows.length - 1].rowY;
        const boxHeight = lastRowY - gridTop + geometry.bubbleRadius + 14;
        const sampleRow = col.rows[0];

        return (
          <g key={col.colIndex}>
            <rect
              x={colX}
              y={gridTop}
              width={boxW}
              height={boxHeight}
              rx="8"
              fill="#ffffff"
              stroke={theme.border}
              strokeWidth="1.2"
            />
            <rect
              x={colX}
              y={gridTop}
              width={boxW}
              height="22"
              rx="8"
              fill={theme.soft}
            />
            <text
              x={sampleRow.numberX}
              y={gridTop + 15}
              textAnchor="middle"
              fontSize="11"
              fontWeight="800"
              fill={theme.accent}
            >
              ข้อ
            </text>
            {sampleRow.bubbles.map((b) => (
              <text
                key={b.choiceIndex}
                x={b.cx}
                y={gridTop + 15}
                textAnchor="middle"
                fontSize="11"
                fontWeight="800"
                fill={theme.accent}
              >
                {getChoiceLabel(b.choiceIndex, config.choiceLabelType)}
              </text>
            ))}

            {/* Rows inside column */}
            {col.rows.map((row) => {
              const isZebra = row.rowInColumn % 2 === 1;
              return (
                <g key={row.questionNumber}>
                  {isZebra && (
                    <rect
                      x={colX + 3}
                      y={row.rowY - geometry.rowPitch * 0.44}
                      width={boxW - 6}
                      height={geometry.rowPitch * 0.88}
                      rx="4"
                      fill="#f8fafc"
                    />
                  )}
                  <text
                    x={row.numberX}
                    y={row.rowY + 4}
                    textAnchor="middle"
                    fontSize={isHalf ? 11.5 : 12.5}
                    fontWeight="800"
                    fill="#0f172a"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {row.questionNumber}.
                  </text>

                  {row.bubbles.map((b) => {
                    const label = getChoiceLabel(b.choiceIndex, config.choiceLabelType);
                    return (
                      <g key={b.choiceIndex}>
                        <circle
                          cx={b.cx}
                          cy={b.cy}
                          r={b.r}
                          fill="#ffffff"
                          stroke="#475569"
                          strokeWidth="1.4"
                        />
                        <text
                          x={b.cx}
                          y={b.cy + (isHalf ? 3.2 : 3.8)}
                          textAnchor="middle"
                          fontSize={Math.max(8, b.r * 1.05)}
                          fontWeight="700"
                          fill="#94a3b8"
                        >
                          {label}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </g>
        );
      })}

      {/* Center Footer strip (Leaves BL/BR anchor zones 100% white!) */}
      <text
        x={geometry.width / 2}
        y={geometry.footerY + 4}
        textAnchor="middle"
        fontSize="10.5"
        fontWeight="700"
        fill="#64748b"
      >
        ClassCare 360 AI Vision OMR • {choiceKeys.length} ตัวเลือก • กรุณาวางกระดาษให้เห็นวงกลม 4 มุมชัดเจนขณะสแกน
      </text>
    </svg>
  );
}

export const PrintableAnswerSheet = forwardRef<HTMLDivElement, PrintableAnswerSheetProps>(
  ({ config, schoolName = 'ClassCare 360 School', isMiniPreview = false, batchStudents }, ref) => {
    const isHalf = config.layout === 'eco_half';
    const hasBatch = Array.isArray(batchStudents) && batchStudents.length > 0;

    // Pair or single-page A4 chunks so both Master mode and Batch Student pre-filled mode print cleanly
    const a4Pages = useMemo(() => {
      if (!hasBatch || !batchStudents) {
        return [
          {
            pageKey: 'master-page',
            topStudent: undefined as PrintableStudentTarget | undefined,
            bottomStudent: undefined as PrintableStudentTarget | undefined,
            showBottomEcoCopy: isHalf,
          },
        ];
      }

      if (!isHalf) {
        return batchStudents.map((st, idx) => ({
          pageKey: `page-${st.id}-${idx}`,
          topStudent: { ...st, rollNumber: st.rollNumber ?? idx + 1 },
          bottomStudent: undefined as PrintableStudentTarget | undefined,
          showBottomEcoCopy: false,
        }));
      }

      const pages: Array<{
        pageKey: string;
        topStudent?: PrintableStudentTarget;
        bottomStudent?: PrintableStudentTarget;
        showBottomEcoCopy: boolean;
      }> = [];

      for (let i = 0; i < batchStudents.length; i += 2) {
        const s1 = { ...batchStudents[i], rollNumber: batchStudents[i].rollNumber ?? i + 1 };
        const s2 = batchStudents[i + 1]
          ? { ...batchStudents[i + 1], rollNumber: batchStudents[i + 1].rollNumber ?? i + 2 }
          : undefined;
        pages.push({
          pageKey: `eco-pair-${i}`,
          topStudent: s1,
          bottomStudent: s2,
          showBottomEcoCopy: Boolean(s2),
        });
      }
      return pages;
    }, [hasBatch, batchStudents, isHalf]);

    return (
      <div
        ref={ref}
        className={`${isMiniPreview ? '' : 'omr-print-active'} space-y-6 print:space-y-0`}
      >
        {!isMiniPreview && (
          <style>{`
            @page {
              size: A4 portrait;
              margin: 0;
            }
            @media print {
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              body:has(.omr-print-active) aside,
              body:has(.omr-print-active) header.app-topbar,
              body:has(.omr-print-active) nav,
              body:has(.omr-print-active) .no-print,
              body:has(.omr-print-active) .omr-no-print {
                display: none !important;
              }
              body:has(.omr-print-active) #root,
              body:has(.omr-print-active) .app-shell,
              body:has(.omr-print-active) .app-content-area,
              body:has(.omr-print-active) main.app-page {
                display: block !important;
                position: static !important;
                width: 100% !important;
                height: auto !important;
                min-height: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: visible !important;
                background: #ffffff !important;
              }
              .omr-a4-page {
                width: 210mm !important;
                height: 297mm !important;
                margin: 0 !important;
                padding: 0 !important;
                box-shadow: none !important;
                border: none !important;
                page-break-after: always !important;
                break-after: page !important;
                overflow: hidden !important;
              }
              .omr-a4-page:last-child {
                page-break-after: auto !important;
                break-after: auto !important;
              }
            }
          `}</style>
        )}

        {a4Pages.map((page) => (
          <div
            key={page.pageKey}
            className="omr-a4-page mx-auto bg-white shadow-lg border border-slate-200 overflow-hidden flex flex-col justify-between"
            style={{ width: '210mm', height: '297mm' }}
          >
            <div style={{ width: '210mm', height: isHalf ? '144mm' : '297mm' }}>
              <SingleAnswerSheetSvg
                config={config}
                schoolName={schoolName}
                prefilledStudent={page.topStudent}
              />
            </div>

            {isHalf && (
              <>
                <div
                  className="flex items-center justify-center border-y border-dashed border-slate-300 text-[10px] font-bold tracking-widest text-slate-400"
                  style={{ height: '9mm' }}
                >
                  ✂ ────────── รอยปรุสำหรับตัดแบ่งครึ่งแผ่น (ECO SAVER 2-IN-1) ────────── ✂
                </div>
                <div style={{ width: '210mm', height: '144mm' }}>
                  {page.showBottomEcoCopy ? (
                    <SingleAnswerSheetSvg
                      config={config}
                      schoolName={schoolName}
                      prefilledStudent={page.bottomStudent}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-slate-50/40 text-xs font-bold text-slate-300">
                      (ส่วนล่างว่างสำหรับแผ่นตัดสุดท้ายของห้อง)
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    );
  }
);

PrintableAnswerSheet.displayName = 'PrintableAnswerSheet';
