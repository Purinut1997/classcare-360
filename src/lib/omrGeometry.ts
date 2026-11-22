import type { AnswerSheetConfig, AnswerSheetLayout } from '../types/omr';

export interface OmrPoint {
  x: number;
  y: number;
}

export interface OmrRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FiducialMarkerSpec {
  id: 'tl' | 'tr' | 'br' | 'bl';
  cx: number;
  cy: number;
  outerRadius: number;
  midWhiteRadius: number;
  innerRadius: number;
}

export interface BubbleTarget {
  cx: number;
  cy: number;
  r: number;
}

export interface StudentIdDigitTrack {
  digitIndex: number; // 0-based (e.g. 0 = tens/first digit)
  label: string;
  orientation: 'vertical' | 'horizontal';
  bubbles: Array<BubbleTarget & { digitValue: number }>;
}

export interface QuestionBubbleRow {
  questionNumber: number;
  columnIndex: number;
  rowInColumn: number;
  rowY: number;
  numberX: number;
  bubbles: Array<BubbleTarget & { choiceIndex: number }>;
}

export interface ExamSetBubbleSpec {
  setCode: string; // '01' | '02' | '03' | '04'
  cx: number;
  cy: number;
  r: number;
}

export interface UnifiedOmrGeometry {
  layout: AnswerSheetLayout;
  width: number;
  height: number;
  fiducials: {
    tl: FiducialMarkerSpec;
    tr: FiducialMarkerSpec;
    br: FiducialMarkerSpec;
    bl: FiducialMarkerSpec;
  };
  /**
   * Asymmetric dark dot near Top-Left ONLY used to disambiguate 0/90/180/270
   * after perspective warp. Symmetric spots at TR/BR/BL are strictly blank.
   */
  orientationAnchor: {
    cx: number;
    cy: number;
    r: number;
  };
  anchorProbes: {
    tl: OmrPoint;
    tr: OmrPoint;
    br: OmrPoint;
    bl: OmrPoint;
  };
  headerBox: OmrRect;
  qrBox: OmrRect;
  scoreBox: OmrRect;
  footerY: number;
  examSetBubbles: ExamSetBubbleSpec[];
  studentIdDigits: StudentIdDigitTrack[];
  answerRows: QuestionBubbleRow[];
  answerCols: number;
  rowsPerCol: number;
  bubbleRadius: number;
  choicePitch: number;
  rowPitch: number;
}

export function getCanonicalDimensions(layout: AnswerSheetLayout): { width: number; height: number } {
  return layout === 'eco_half'
    ? { width: 1000, height: 686 }
    : { width: 1000, height: 1414 };
}

/**
 * Single-Source-of-Truth OMR Sheet Geometry used identically by:
 * 1) PrintableAnswerSheet (SVG vector print & PDF export)
 * 2) OmrVision / OmrEngine (perspective warp target, QR crop, bubble sampling, overlay)
 * 3) Synthetic / skewed sheet test generator
 */
export function getUnifiedSheetGeometry(config: Pick<
  AnswerSheetConfig,
  'layout' | 'totalQuestions' | 'choicesCount' | 'studentIdFormat'
>): UnifiedOmrGeometry {
  const layout: AnswerSheetLayout = config.layout === 'eco_half' ? 'eco_half' : 'single_full';
  const { width, height } = getCanonicalDimensions(layout);
  const choicesCount = config.choicesCount || 4;
  const maxSupported = layout === 'eco_half' ? 60 : 100;
  const totalQuestions = Math.max(1, Math.min(maxSupported, config.totalQuestions || 20));
  const studentIdFormat = config.studentIdFormat || 'roll_number';

  const isHalf = layout === 'eco_half';
  const fMarginX = 48;
  const fMarginY = isHalf ? 42 : 48;
  const outerR = isHalf ? 14 : 15;
  const midWhiteR = isHalf ? 9 : 9.5;
  const innerR = isHalf ? 4.5 : 5;

  const fiducials: UnifiedOmrGeometry['fiducials'] = {
    tl: { id: 'tl', cx: fMarginX, cy: fMarginY, outerRadius: outerR, midWhiteRadius: midWhiteR, innerRadius: innerR },
    tr: { id: 'tr', cx: width - fMarginX, cy: fMarginY, outerRadius: outerR, midWhiteRadius: midWhiteR, innerRadius: innerR },
    br: { id: 'br', cx: width - fMarginX, cy: height - fMarginY, outerRadius: outerR, midWhiteRadius: midWhiteR, innerRadius: innerR },
    bl: { id: 'bl', cx: fMarginX, cy: height - fMarginY, outerRadius: outerR, midWhiteRadius: midWhiteR, innerRadius: innerR },
  };

  // Asymmetric TL orientation anchor (other 3 symmetric spots kept pure white in print!)
  const anchorOffsetX = 42;
  const orientationAnchor = {
    cx: fMarginX + anchorOffsetX,
    cy: fMarginY,
    r: isHalf ? 7.5 : 8,
  };
  const anchorProbes = {
    tl: { x: fMarginX + anchorOffsetX, y: fMarginY },
    tr: { x: width - (fMarginX + anchorOffsetX), y: fMarginY },
    br: { x: width - (fMarginX + anchorOffsetX), y: height - fMarginY },
    bl: { x: fMarginX + anchorOffsetX, y: height - fMarginY },
  };

  // Header, QR, Exam Set & Student ID grids
  const headerBox: OmrRect = isHalf
    ? { x: 42, y: 66, width: 916, height: 158 }
    : { x: 42, y: 74, width: 916, height: 218 };

  const qrBox: OmrRect = isHalf
    ? { x: 822, y: 76, width: 124, height: 124 }
    : { x: 788, y: 86, width: 156, height: 156 };

  const scoreBox: OmrRect = isHalf
    ? { x: 264, y: 174, width: 122, height: 42 }
    : { x: 230, y: 236, width: 130, height: 48 };

  const examSetBubbles: ExamSetBubbleSpec[] = ['01', '02', '03', '04'].map((setCode, idx) => ({
    setCode,
    cx: isHalf ? 416 : 406,
    cy: (isHalf ? 104 : 130) + idx * (isHalf ? 26 : 32),
    r: isHalf ? 5.8 : 7,
  }));

  const numDigits = studentIdFormat === 'student_code' ? 5 : 2;
  const studentIdDigits: StudentIdDigitTrack[] = [];

  if (isHalf) {
    // Horizontal rows per digit in eco_half so bubbles remain generous and readable
    const isCode = numDigits === 5;
    const startX = isCode ? 506 : 510;
    const colPitch = isCode ? 28 : 28;
    const startY = isCode ? 94 : 114;
    const rowPitch = isCode ? 25 : 40;
    const r = isCode ? 6.2 : 7.5;

    for (let d = 0; d < numDigits; d++) {
      const bubbles: Array<BubbleTarget & { digitValue: number }> = [];
      for (let v = 0; v <= 9; v++) {
        bubbles.push({
          digitValue: v,
          cx: startX + v * colPitch,
          cy: startY + d * rowPitch,
          r,
        });
      }
      studentIdDigits.push({
        digitIndex: d,
        label: isCode ? `รหัส ${d + 1}` : d === 0 ? 'หลักสิบ' : 'หลักหน่วย',
        orientation: 'horizontal',
        bubbles,
      });
    }
  } else {
    // Standard Thai vertical digit columns in single_full
    const colPitch = numDigits === 5 ? 36 : 44;
    const startX = numDigits === 5 ? 496 : 532;
    const startY = 114;
    const rowPitch = 16.5;
    const r = 6.5;

    for (let d = 0; d < numDigits; d++) {
      const bubbles: Array<BubbleTarget & { digitValue: number }> = [];
      for (let v = 0; v <= 9; v++) {
        bubbles.push({
          digitValue: v,
          cx: startX + d * colPitch,
          cy: startY + v * rowPitch,
          r,
        });
      }
      studentIdDigits.push({
        digitIndex: d,
        label: numDigits === 2 ? (d === 0 ? 'สิบ' : 'หน่วย') : `ร.${d + 1}`,
        orientation: 'vertical',
        bubbles,
      });
    }
  }

  // Determine optimal column & row partitioning for answer grid
  let answerCols = 2;
  if (isHalf) {
    if (totalQuestions <= 20) answerCols = 2;
    else if (totalQuestions <= 45) answerCols = 3;
    else answerCols = 4;
  } else {
    if (totalQuestions <= 40) answerCols = 2;
    else if (totalQuestions <= 60) answerCols = 3;
    else answerCols = 4;
  }

  const rowsPerCol = Math.ceil(totalQuestions / answerCols);
  const gridLeft = 44;
  const gridWidth = 912;
  const colWidth = gridWidth / answerCols;

  const gridTop = isHalf ? 242 : 320;
  const gridBottom = isHalf ? 624 : 1336;
  const availHeight = gridBottom - gridTop;

  // Compute row pitch & bubble radius bounded comfortably within cell width & height
  const maxRowPitch = isHalf ? 36 : 44;
  const rowPitch = Math.min(maxRowPitch, (availHeight - 28) / Math.max(1, rowsPerCol));
  const numberColWidth = answerCols >= 4 ? 38 : 46;
  const usableColSpan = colWidth - numberColWidth - 16;
  const choicePitch = Math.min(isHalf ? 38 : 44, usableColSpan / Math.max(1, choicesCount));

  const maxRadiusByRow = rowPitch * 0.36;
  const maxRadiusByChoice = choicePitch * 0.36;
  const bubbleRadius = Math.max(
    isHalf ? 5.8 : 7.0,
    Math.min(isHalf ? 9.5 : 11.2, maxRadiusByRow, maxRadiusByChoice)
  );

  const firstRowY = gridTop + 34;
  const answerRows: QuestionBubbleRow[] = [];

  for (let q = 1; q <= totalQuestions; q++) {
    const columnIndex = Math.floor((q - 1) / rowsPerCol);
    const rowInColumn = (q - 1) % rowsPerCol;
    const colStartX = gridLeft + columnIndex * colWidth;
    const rowY = firstRowY + rowInColumn * rowPitch;
    const numberX = colStartX + 26;
    const firstBubbleX = colStartX + numberColWidth + choicePitch * 0.5 + 4;

    const bubbles: Array<BubbleTarget & { choiceIndex: number }> = [];
    for (let c = 0; c < choicesCount; c++) {
      bubbles.push({
        choiceIndex: c,
        cx: firstBubbleX + c * choicePitch,
        cy: rowY,
        r: bubbleRadius,
      });
    }

    answerRows.push({
      questionNumber: q,
      columnIndex,
      rowInColumn,
      rowY,
      numberX,
      bubbles,
    });
  }

  return {
    layout,
    width,
    height,
    fiducials,
    orientationAnchor,
    anchorProbes,
    headerBox,
    qrBox,
    scoreBox,
    footerY: height - fMarginY,
    examSetBubbles,
    studentIdDigits,
    answerRows,
    answerCols,
    rowsPerCol,
    bubbleRadius,
    choicePitch,
    rowPitch,
  };
}

/**
 * Legacy helper signature retained so existing callers keep working seamlessly
 * while shifting under the hood to the canonical single-source-of-truth geometry.
 */
export function getOmrSheetGeometry(config: AnswerSheetConfig) {
  return getUnifiedSheetGeometry(config);
}
