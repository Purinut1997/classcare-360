import QRCode from 'qrcode';
import type {
  AnswerSheetConfig,
  ChoiceLabelType,
  ItemAnalysisStat,
  OmrRecordingMode,
  OmrScanOrientation,
  OmrStudentMode,
  ScannedAnswerDetail,
  ScannedExamResult,
} from '../types/omr';
import { getCanonicalDimensions, getOmrSheetGeometry, getUnifiedSheetGeometry } from './omrGeometry';
import {
  decodeSheetQr,
  distortCanvasPerspective,
  renderAnnotatedOverlay,
  sampleBubbleLocalContrast,
  warpPerspectiveToCanvas,
} from './omrVision';

export { getCanonicalDimensions, getOmrSheetGeometry, getUnifiedSheetGeometry };

export const CHOICE_KEYS_ABCD = ['A', 'B', 'C', 'D', 'E'];
export const CHOICE_LABELS_THAI = ['ก', 'ข', 'ค', 'ง', 'จ'];
export const CHOICE_LABELS_NUM = ['1', '2', '3', '4', '5'];

export function getChoiceLabel(idx: number, type: ChoiceLabelType): string {
  const safeIdx = Math.max(0, Math.min(4, idx));
  if (type === 'THAI') return CHOICE_LABELS_THAI[safeIdx];
  if (type === 'NUMERIC') return CHOICE_LABELS_NUM[safeIdx];
  return CHOICE_KEYS_ABCD[safeIdx];
}

export function getChoiceKey(label: string, type: ChoiceLabelType): string {
  const clean = label.trim().toUpperCase();
  if (type === 'THAI') {
    const idx = CHOICE_LABELS_THAI.indexOf(label.trim());
    return idx >= 0 ? CHOICE_KEYS_ABCD[idx] : clean;
  }
  if (type === 'NUMERIC') {
    const idx = CHOICE_LABELS_NUM.indexOf(label.trim());
    return idx >= 0 ? CHOICE_KEYS_ABCD[idx] : clean;
  }
  return clean;
}

class OmrAudioFeedback {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      if (!this.ctx) this.ctx = new AudioCtx();
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  private beep(freq: number, durationMs: number, volume = 0.08, type: OscillatorType = 'sine'): void {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + durationMs / 1000);
    } catch {
      // Ignore WebAudio autoplay restrictions
    }
  }

  playSuccess(): void {
    this.beep(880, 90, 0.08);
    setTimeout(() => this.beep(1174, 120, 0.08), 80);
  }

  playWarning(): void {
    this.beep(520, 120, 0.08, 'triangle');
    setTimeout(() => this.beep(420, 160, 0.08, 'triangle'), 130);
  }

  playClick(): void {
    this.beep(720, 65, 0.06);
  }
}

export const omrAudio = new OmrAudioFeedback();

/**
 * Legacy helper retained for rotated canvas drawing.
 */
export function drawRotatedToCanvas(
  source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  degrees: 0 | 90 | 180 | 270
): HTMLCanvasElement {
  const srcW =
    source instanceof HTMLVideoElement
      ? source.videoWidth
      : source instanceof HTMLImageElement
        ? source.naturalWidth || source.width
        : source.width;
  const srcH =
    source instanceof HTMLVideoElement
      ? source.videoHeight
      : source instanceof HTMLImageElement
        ? source.naturalHeight || source.height
        : source.height;

  const canvas = document.createElement('canvas');
  if (degrees === 90 || degrees === 270) {
    canvas.width = srcH;
    canvas.height = srcW;
  } else {
    canvas.width = srcW;
    canvas.height = srcH;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(source, -srcW / 2, -srcH / 2, srcW, srcH);
  ctx.restore();
  return canvas;
}

export function detectBestOrientation(
  source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  config: AnswerSheetConfig
): { canvas: HTMLCanvasElement; orientation: 0 | 90 | 180 | 270 } {
  const geometry = getUnifiedSheetGeometry(config);
  const baseCanvas = drawRotatedToCanvas(source, 0);
  const warped = warpPerspectiveToCanvas(baseCanvas, geometry);
  return {
    canvas: warped.warpedCanvas,
    orientation: warped.detectedOrientation,
  };
}

/**
 * Resolve effective answer keys for a given examSet code (falling back to primary config.answerKeys).
 */
export function resolveEffectiveAnswerKeys(
  config: AnswerSheetConfig,
  examSetCode?: string | null
): Record<number, string> {
  const targetSet = examSetCode || config.examSet || '01';
  const setKeys = config.examSets?.[targetSet];
  if (setKeys && Object.keys(setKeys).length > 0) {
    return setKeys;
  }
  return config.answerKeys || {};
}

/**
 * Unified single-question grading logic handling single key, multiple accepted keys, and bonus questions.
 */
export function gradeSingleQuestion(
  questionNumber: number,
  detectedChoice: string | null,
  fillRatios: Record<string, number>,
  config: AnswerSheetConfig,
  effectiveKeys?: Record<number, string>,
  rawFlag?: ScannedAnswerDetail['flag']
): ScannedAnswerDetail {
  const choiceKeys = CHOICE_KEYS_ABCD.slice(0, config.choicesCount);
  const keyMap = effectiveKeys ?? resolveEffectiveAnswerKeys(config);
  const correctChoice = keyMap[questionNumber] || 'A';
  const maxPts = config.pointsPerQuestion?.[questionNumber] ?? 1;
  const isBonus = Boolean(config.bonusQuestions?.[questionNumber]);
  const multiList = config.multiAnswerKeys?.[questionNumber];
  const acceptedChoices = isBonus
    ? choiceKeys
    : multiList && multiList.length > 0
      ? multiList
      : [correctChoice];

  const isCorrect = isBonus
    ? true
    : Boolean(detectedChoice && acceptedChoices.includes(detectedChoice));

  let flag: ScannedAnswerDetail['flag'] = rawFlag;
  if (isBonus) {
    flag = 'bonus';
  } else if (!flag) {
    if (!detectedChoice) flag = 'blank';
    else if (detectedChoice === 'MULTIPLE') flag = 'multiple';
    else flag = 'ok';
  }

  return {
    questionNumber,
    detectedChoice,
    correctChoice: acceptedChoices[0] || correctChoice,
    acceptedChoices,
    isBonus,
    isCorrect,
    scoreAwarded: isCorrect ? maxPts : 0,
    maxScore: maxPts,
    fillRatios,
    flag,
  };
}

/**
 * Re-grades previously scanned sheets immediately when answer keys, bonus flags,
 * multi-answer keys, or question points are updated without re-scanning paper.
 */
export function regradeScannedResults(
  results: ScannedExamResult[],
  config: AnswerSheetConfig
): ScannedExamResult[] {
  const choiceKeys = CHOICE_KEYS_ABCD.slice(0, config.choicesCount);

  return results.map((res) => {
    const examSetToUse = res.detectedExamSet || config.examSet || '01';
    const effectiveKeys = resolveEffectiveAnswerKeys(config, examSetToUse);

    let totalScore = 0;
    let maxScore = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let blankCount = 0;
    let multipleCount = 0;
    let faintCount = 0;

    const updatedDetails: ScannedAnswerDetail[] = [];
    for (let q = 1; q <= config.totalQuestions; q++) {
      const existing = res.answersDetail.find((d) => d.questionNumber === q);
      const detected = res.detectedAnswers[q] ?? existing?.detectedChoice ?? null;
      const fillRatios = existing?.fillRatios || {};
      const preserveFaint = existing?.flag === 'faint' ? 'faint' : undefined;

      const detail = gradeSingleQuestion(q, detected, fillRatios, config, effectiveKeys, preserveFaint);
      updatedDetails.push(detail);

      maxScore += detail.maxScore;
      totalScore += detail.scoreAwarded;
      if (detail.isCorrect) {
        correctCount++;
      } else {
        incorrectCount++;
      }
      if (!detail.isBonus) {
        if (!detected) blankCount++;
        else if (detected === 'MULTIPLE') multipleCount++;
        else if (detail.flag === 'faint') faintCount++;
      }
    }

    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 1000) / 10 : 0;
    const flags: string[] = [];
    if (res.detectedExamSet && res.detectedExamSet !== config.examSet) {
      flags.push(`ตรวจพบชุดข้อสอบอัตโนมัติ: ชุด ${res.detectedExamSet}`);
    }
    if (!res.studentId && res.studentMode === 'classroom') {
      flags.push('ยังไม่พบข้อมูลนักเรียนที่ตรงกัน กรุณาเลือกชื่อนักเรียน');
    }
    if (multipleCount > 0) flags.push(`พบการฝนเกิน 1 ตัวเลือก ${multipleCount} ข้อ`);
    if (faintCount > 0) flags.push(`พบการฝนจาง ${faintCount} ข้อ`);
    if (blankCount > Math.ceil(config.totalQuestions * 0.25)) {
      flags.push(`เว้นว่างจำนวนมาก (${blankCount} ข้อ)`);
    }

    const effectiveChoiceKeys = choiceKeys;
    void effectiveChoiceKeys;

    return {
      ...res,
      answersDetail: updatedDetails,
      totalScore: Math.round(totalScore * 100) / 100,
      maxScore: Math.round(maxScore * 100) / 100,
      percentage,
      correctCount,
      incorrectCount,
      blankCount,
      multipleCount,
      flags,
    };
  });
}

/**
 * Full perspective-corrected OMR scanner pipeline:
 * 1) Fiducial quad detection + 8-DOF homography warp + TL anchor orientation lock
 * 2) QR decoding (exam set + pre-filled student identity)
 * 3) Student ID bubble grid (2-digit roll_number or 5-digit student_code) + exam set fallback
 * 4) Local adaptive contrast bubble sampling + relative row ranking
 * 5) Multi-key & Bonus question grading + Annotated verification overlay image
 */
export async function analyzeAnswerSheetImage(
  imageSource: HTMLCanvasElement | HTMLImageElement | HTMLVideoElement,
  config: AnswerSheetConfig,
  options?: {
    studentMode?: OmrStudentMode;
    recordingMode?: OmrRecordingMode;
    targetStudentList?: Array<{
      id: string;
      student_code: string;
      first_name: string;
      last_name: string;
    }>;
    orientation?: OmrScanOrientation;
  }
): Promise<ScannedExamResult> {
  const studentMode = options?.studentMode || 'classroom';
  const recordingMode = options?.recordingMode || 'verify_first';
  const targetList = options?.targetStudentList || [];
  const geometry = getUnifiedSheetGeometry(config);

  // Step 1: Copy source onto base canvas (apply forced rotation only if specified cleanly)
  let baseCanvas: HTMLCanvasElement;
  const optOrient = options?.orientation ?? 'auto';
  if (optOrient === 90 || optOrient === 180 || optOrient === 270) {
    baseCanvas = drawRotatedToCanvas(imageSource, optOrient);
  } else {
    baseCanvas = drawRotatedToCanvas(imageSource, 0);
  }

  // Step 2: Perspective fiducial detection + homography warp + deterministic orientation lock
  const warpResult = warpPerspectiveToCanvas(baseCanvas, geometry);
  const { warpedCanvas, perspectiveCorrected, detectedOrientation } = warpResult;

  const wCtx = warpedCanvas.getContext('2d', { willReadFrequently: true });
  const imgData = wCtx
    ? wCtx.getImageData(0, 0, warpedCanvas.width, warpedCanvas.height).data
    : new Uint8ClampedArray(0);
  const imgW = warpedCanvas.width;
  const imgH = warpedCanvas.height;

  // Step 3: Decode QR metadata (Exam set, Pre-filled Student ID / Roll)
  const qrResult = decodeSheetQr(warpedCanvas, geometry, baseCanvas);
  const qrParsed = qrResult?.parsed || null;

  let detectedExamSet: string | null =
    qrParsed && typeof qrParsed.set === 'string' && qrParsed.set.trim()
      ? qrParsed.set.trim()
      : null;

  let detectedSetBubble: { cx: number; cy: number; r: number } | null = null;
  if (imgData.length > 0) {
    const setScores = geometry.examSetBubbles.map((sb) => ({
      spec: sb,
      fill: sampleBubbleLocalContrast(imgData, imgW, imgH, sb.cx, sb.cy, sb.r),
    }));
    setScores.sort((a, b) => b.fill - a.fill);
    if (!detectedExamSet && setScores[0].fill >= 0.34 && (!setScores[1] || setScores[0].fill - setScores[1].fill >= 0.12)) {
      detectedExamSet = setScores[0].spec.setCode;
      detectedSetBubble = setScores[0].spec;
    } else if (detectedExamSet) {
      const matched = geometry.examSetBubbles.find((b) => b.setCode === detectedExamSet);
      if (matched) detectedSetBubble = matched;
    }
  }

  const effectiveExamSet = detectedExamSet || config.examSet || '01';
  const effectiveAnswerKeys = resolveEffectiveAnswerKeys(config, effectiveExamSet);

  // Step 4: Identify Student (QR pre-filled sid/roll first, then Student ID bubble tracks)
  let studentId: string | null = null;
  let studentRollNumber: number | null = null;
  let studentCode: string | null = null;
  let studentName = studentMode === 'anonymous' ? 'ไม่ระบุชื่อ (นิรนาม)' : 'ไม่พบข้อมูลนักเรียน';
  const detectedIdBubbles: Array<{ cx: number; cy: number; r: number }> = [];

  if (qrParsed) {
    if (typeof qrParsed.sid === 'string' && qrParsed.sid.trim()) {
      const byId = targetList.find((s) => s.id === qrParsed.sid);
      if (byId) {
        studentId = byId.id;
        studentCode = byId.student_code;
        const idx = targetList.findIndex((s) => s.id === byId.id);
        studentRollNumber = idx >= 0 ? idx + 1 : null;
        studentName = `${byId.first_name} ${byId.last_name}`.trim();
      }
    }
    if (studentRollNumber === null && typeof qrParsed.roll === 'number') {
      studentRollNumber = qrParsed.roll;
    } else if (studentRollNumber === null && typeof qrParsed.roll === 'string' && /^\d+$/.test(qrParsed.roll)) {
      studentRollNumber = parseInt(qrParsed.roll, 10);
    }
  }

  if (config.studentIdFormat !== 'none' && imgData.length > 0) {
    const readDigits: Array<number | null> = [];
    for (const track of geometry.studentIdDigits) {
      const scores = track.bubbles.map((b) => ({
        bubble: b,
        fill: sampleBubbleLocalContrast(imgData, imgW, imgH, b.cx, b.cy, b.r),
      }));
      scores.sort((a, b) => b.fill - a.fill);
      if (scores[0] && scores[0].fill >= 0.30 && (!scores[1] || scores[0].fill - scores[1].fill >= 0.11)) {
        readDigits.push(scores[0].bubble.digitValue);
        detectedIdBubbles.push(scores[0].bubble);
      } else {
        readDigits.push(null);
      }
    }

    if (config.studentIdFormat === 'student_code') {
      if (readDigits.every((d) => d !== null)) {
        const codeStr = readDigits.join('');
        studentCode = codeStr;
        if (!studentId && targetList.length > 0) {
          const matched = targetList.find(
            (s) => s.student_code === codeStr || s.student_code?.endsWith(codeStr) || String(parseInt(s.student_code || '0', 10)) === String(parseInt(codeStr, 10))
          );
          if (matched) {
            studentId = matched.id;
            const idx = targetList.findIndex((s) => s.id === matched.id);
            studentRollNumber = idx >= 0 ? idx + 1 : null;
            studentName = `${matched.first_name} ${matched.last_name}`.trim();
          } else {
            studentName = `รหัสประจำตัว ${codeStr}`;
          }
        }
      }
    } else if (config.studentIdFormat === 'roll_number') {
      const d0 = readDigits[0];
      const d1 = readDigits[1];
      let parsedRoll: number | null = null;
      if (d0 !== null && d1 !== null) parsedRoll = d0 * 10 + d1;
      else if (d0 === null && d1 !== null) parsedRoll = d1;

      if (parsedRoll !== null && parsedRoll > 0) {
        if (studentRollNumber === null) studentRollNumber = parsedRoll;
        if (!studentId && studentMode === 'classroom' && targetList.length > 0) {
          const matched = targetList[parsedRoll - 1] || targetList.find((s) => parseInt(s.student_code || '0', 10) === parsedRoll);
          if (matched) {
            studentId = matched.id;
            studentCode = matched.student_code;
            studentName = `${matched.first_name} ${matched.last_name}`.trim();
          } else {
            studentName = `เลขที่ ${String(parsedRoll).padStart(2, '0')}`;
          }
        } else if (!studentId && studentMode === 'classroom') {
          studentName = `เลขที่ ${String(parsedRoll).padStart(2, '0')}`;
        }
      }
    }
  }

  if (!studentId && studentMode === 'classroom' && studentRollNumber !== null && targetList[studentRollNumber - 1]) {
    const matched = targetList[studentRollNumber - 1];
    studentId = matched.id;
    studentCode = matched.student_code;
    studentName = `${matched.first_name} ${matched.last_name}`.trim();
  }

  // Step 5: Read answer bubbles with local adaptive contrast + relative row ranking
  const choiceKeys = CHOICE_KEYS_ABCD.slice(0, config.choicesCount);
  const detectedAnswers: Record<number, string | null> = {};
  const answersDetail: ScannedAnswerDetail[] = [];

  let totalScore = 0;
  let maxScore = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let blankCount = 0;
  let multipleCount = 0;
  let faintCount = 0;
  let marginConfidenceSum = 0;

  for (const row of geometry.answerRows) {
    const q = row.questionNumber;
    const fillRatios: Record<string, number> = {};
    const scored: Array<{ key: string; fill: number }> = [];

    for (const b of row.bubbles) {
      const cKey = choiceKeys[b.choiceIndex];
      const fill = imgData.length > 0
        ? sampleBubbleLocalContrast(imgData, imgW, imgH, b.cx, b.cy, b.r)
        : 0;
      fillRatios[cKey] = fill;
      scored.push({ key: cKey, fill });
    }

    scored.sort((a, b) => b.fill - a.fill);
    const top1 = scored[0] || { key: 'A', fill: 0 };
    const top2 = scored[1] || { key: 'B', fill: 0 };

    let detectedChoice: string | null = null;
    let rawFlag: ScannedAnswerDetail['flag'] = 'ok';

    if (top1.fill < 0.24) {
      detectedChoice = null;
      rawFlag = 'blank';
      marginConfidenceSum += 0.92;
    } else if (top2.fill >= 0.30 && (top1.fill - top2.fill) < 0.13 && top2.fill >= top1.fill * 0.62) {
      detectedChoice = 'MULTIPLE';
      rawFlag = 'multiple';
      marginConfidenceSum += 0.45;
    } else if (top1.fill < 0.38 || (top1.fill - top2.fill) < 0.10) {
      detectedChoice = top1.key;
      rawFlag = 'faint';
      marginConfidenceSum += 0.72;
    } else {
      detectedChoice = top1.key;
      rawFlag = 'ok';
      marginConfidenceSum += Math.min(1, 0.78 + (top1.fill - top2.fill) * 0.4);
    }

    detectedAnswers[q] = detectedChoice;
    const detail = gradeSingleQuestion(q, detectedChoice, fillRatios, config, effectiveAnswerKeys, rawFlag);
    answersDetail.push(detail);

    maxScore += detail.maxScore;
    totalScore += detail.scoreAwarded;
    if (detail.isCorrect) {
      correctCount++;
    } else {
      incorrectCount++;
    }
    if (!detail.isBonus) {
      if (!detectedChoice) blankCount++;
      else if (detectedChoice === 'MULTIPLE') multipleCount++;
      else if (detail.flag === 'faint') faintCount++;
    }
  }

  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 1000) / 10 : 0;
  const avgConfidence =
    geometry.answerRows.length > 0
      ? Math.round((marginConfidenceSum / geometry.answerRows.length) * (perspectiveCorrected ? 1 : 0.85) * 100) / 100
      : 0.9;

  const flags: string[] = [];
  if (!perspectiveCorrected) {
    flags.push('ตรวจจับมุมกระดาษ 4 มุมไม่ครบ ระบบอ่านจากกรอบตรง (แนะนำให้วางกระดาษให้เห็นเป้า 4 มุมชัดเจน)');
  }
  if (detectedExamSet && detectedExamSet !== (config.examSet || '01')) {
    flags.push(`ตรวจพบชุดข้อสอบอัตโนมัติ: ชุด ${detectedExamSet}`);
  }
  if (!studentId && studentMode === 'classroom') {
    flags.push('ยังไม่สามารถจับคู่นักเรียนอัตโนมัติ กรุณาตรวจสอบเลขที่/รหัสหรือเลือกชื่อนักเรียน');
  }
  if (multipleCount > 0) flags.push(`พบการฝนเกิน 1 ตัวเลือก ${multipleCount} ข้อ`);
  if (faintCount > 0) flags.push(`พบการฝนจางหรือคล้ายรอยลบ ${faintCount} ข้อ`);
  if (blankCount > Math.ceil(config.totalQuestions * 0.25)) {
    flags.push(`เว้นว่างจำนวนมาก (${blankCount} ข้อ)`);
  }

  // Step 6: Generate annotated verification overlay directly on warped upright sheet
  const annotatedOverlayUrl = renderAnnotatedOverlay(warpedCanvas, geometry, answersDetail, {
    choiceKeys,
    detectedIdBubbles,
    detectedSetBubble,
  });

  let status: ScannedExamResult['status'] = 'pending_review';
  if (recordingMode === 'display_only') status = 'display_only';
  else if (flags.length > 0) status = 'flagged';
  else if (recordingMode === 'instant_auto' && studentId) status = 'confirmed';

  return {
    id: `omr_res_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    scannedAt: new Date().toISOString(),
    studentMode,
    studentId,
    studentRollNumber,
    studentCode,
    studentName,
    detectedAnswers,
    answersDetail,
    totalScore: Math.round(totalScore * 100) / 100,
    maxScore: Math.round(maxScore * 100) / 100,
    percentage,
    correctCount,
    incorrectCount,
    blankCount,
    multipleCount,
    confidence: Math.max(0.25, Math.min(0.99, avgConfidence)),
    status,
    flags,
    recordingMode,
    isSavedToGradebook: false,
    previewImageUrl: annotatedOverlayUrl,
    annotatedOverlayUrl,
    detectedOrientation: warpResult.detectedOrientation,
    detectedExamSet: effectiveExamSet,
    detectedQrPayload: qrParsed,
    perspectiveCorrected,
    usedAiFallback: false,
  };
}

function drawDarkBubble(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  fillStyle = '#0f172a'
): void {
  ctx.fillStyle = fillStyle;
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(2, r - 1.2), 0, Math.PI * 2);
  ctx.fill();
}

function drawQrSyncOnCanvas(
  ctx: CanvasRenderingContext2D,
  payload: string,
  x: number,
  y: number,
  size: number
): void {
  try {
    const qr = QRCode.create(payload, { errorCorrectionLevel: 'M' });
    const count = qr.modules.size;
    const quiet = 6;
    const cellSize = (size - quiet * 2) / count;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = '#0f172a';

    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.modules.get(r, c)) {
          ctx.fillRect(x + quiet + c * cellSize, y + quiet + r * cellSize, Math.ceil(cellSize), Math.ceil(cellSize));
        }
      }
    }
  } catch {
    ctx.strokeStyle = '#94a3b8';
    ctx.strokeRect(x, y, size, size);
  }
}

/**
 * Generates a realistic synthetic filled OMR sheet matching UnifiedOmrGeometry 1:1,
 * optionally rotated and perspective-skewed + shadowed on a desk background.
 */
export function generateSyntheticFilledSheet(
  config: AnswerSheetConfig,
  options?: {
    rollNumber?: number;
    studentCode?: string;
    accuracyRate?: number;
    rotation?: 0 | 90 | 180 | 270;
    tiltDeg?: number;
    perspectiveSkew?: number;
    shadowGradient?: boolean;
    studentName?: string;
    studentId?: string;
  }
): HTMLCanvasElement {
  const geometry = getUnifiedSheetGeometry(config);
  const { width, height, fiducials, orientationAnchor, headerBox, qrBox } = geometry;
  const choiceKeys = CHOICE_KEYS_ABCD.slice(0, config.choicesCount);
  const accuracy = options?.accuracyRate ?? 0.85;
  const rollNumber = options?.rollNumber ?? 1;
  const examSet = config.examSet || '01';
  const effectiveKeys = resolveEffectiveAnswerKeys(config, examSet);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Paper base
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // 4 Concentric Fiducial Targets
  [fiducials.tl, fiducials.tr, fiducials.br, fiducials.bl].forEach((f) => {
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(f.cx, f.cy, f.outerRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(f.cx, f.cy, f.midWhiteRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(f.cx, f.cy, f.innerRadius, 0, Math.PI * 2);
    ctx.fill();
  });

  // Asymmetric TL orientation anchor (other 3 corners intentionally clean white)
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(orientationAnchor.cx, orientationAnchor.cy, orientationAnchor.r, 0, Math.PI * 2);
  ctx.fill();

  // Top Header Label
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px Anuphan, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(config.title || 'กระดาษคำตอบ OMR', width / 2, fiducials.tl.cy + 6);

  // Header Border
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(headerBox.x, headerBox.y, headerBox.width, headerBox.height);

  // Metadata text left side
  ctx.textAlign = 'left';
  ctx.font = 'bold 16px Anuphan, sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.fillText(`วิชา: ${config.subjectName || 'วิชาทั่วไป'}`, headerBox.x + 16, headerBox.y + 32);
  ctx.font = '14px Anuphan, sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText(
    `ชุด ${examSet} • ${config.totalQuestions} ข้อ • เลขที่ ${String(rollNumber).padStart(2, '0')}`,
    headerBox.x + 16,
    headerBox.y + 58
  );
  if (options?.studentName) {
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 15px Anuphan, sans-serif';
    ctx.fillText(options.studentName, headerBox.x + 16, headerBox.y + 90);
  }

  // QR Code
  if (config.showQrCode !== false) {
    const qrPayload = JSON.stringify({
      app: 'CC360',
      id: config.id,
      set: examSet,
      tq: config.totalQuestions,
      roll: rollNumber,
      ...(options?.studentId ? { sid: options.studentId } : {}),
    });
    drawQrSyncOnCanvas(ctx, qrPayload, qrBox.x, qrBox.y, qrBox.width);
  }

  // Exam Set Bubbles
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'left';
  geometry.examSetBubbles.forEach((sb) => {
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(sb.cx, sb.cy, sb.r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#475569';
    ctx.fillText(sb.setCode, sb.cx - sb.r - 22, sb.cy + 4);
    if (sb.setCode === examSet) {
      drawDarkBubble(ctx, sb.cx, sb.cy, sb.r, '#111827');
    }
  });

  // Student ID Digits
  const codeDigitsStr =
    options?.studentCode && /^\d+$/.test(options.studentCode)
      ? options.studentCode.padStart(5, '0').slice(-5)
      : String(rollNumber).padStart(config.studentIdFormat === 'student_code' ? 5 : 2, '0');

  if (config.studentIdFormat !== 'none') {
    geometry.studentIdDigits.forEach((track, dIdx) => {
      const targetDigit = parseInt(codeDigitsStr[dIdx] || '0', 10);
      track.bubbles.forEach((b) => {
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(b.cx, b.cy, b.r, 0, Math.PI * 2);
        ctx.stroke();
        if (b.digitValue === targetDigit) {
          drawDarkBubble(ctx, b.cx, b.cy, b.r, '#111827');
        } else {
          ctx.fillStyle = '#94a3b8';
          ctx.font = '9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(String(b.digitValue), b.cx, b.cy + 3);
        }
      });
    });
  }

  // Answer Bubbles
  for (const row of geometry.answerRows) {
    const q = row.questionNumber;
    const correctKey = effectiveKeys[q] || 'A';
    const isCorrectMark = Math.random() < accuracy;
    const isBlankMark = !isCorrectMark && Math.random() < 0.08;
    const wrongChoices = choiceKeys.filter((c) => c !== correctKey);
    const chosenKey = isBlankMark
      ? null
      : isCorrectMark
        ? correctKey
        : wrongChoices[Math.floor(Math.random() * Math.max(1, wrongChoices.length))] || 'B';

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${q}.`, row.numberX, row.rowY + 4);

    for (const b of row.bubbles) {
      const key = choiceKeys[b.choiceIndex];
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(b.cx, b.cy, b.r, 0, Math.PI * 2);
      ctx.stroke();

      if (chosenKey === key) {
        drawDarkBubble(ctx, b.cx, b.cy, b.r, '#111827');
      } else {
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 10px Anuphan, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(getChoiceLabel(b.choiceIndex, config.choiceLabelType), b.cx, b.cy + 3.5);
      }
    }
  }

  // Footer
  ctx.fillStyle = '#64748b';
  ctx.font = '11px Anuphan, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ClassCare 360 AI OMR System', width / 2, geometry.footerY + 4);

  // Apply perspective warp/tilt/rotation/shadow simulation if requested
  if (
    options?.rotation ||
    options?.tiltDeg ||
    options?.perspectiveSkew ||
    options?.shadowGradient
  ) {
    return distortCanvasPerspective(canvas, {
      rotation: options.rotation ?? 0,
      tiltDeg: options.tiltDeg ?? 0,
      perspectiveSkew: options.perspectiveSkew ?? 0,
      shadowGradient: options.shadowGradient ?? false,
    });
  }

  return canvas;
}

/**
 * Computes Item Analysis statistics across all scanned results (supporting bonus & multi-key questions).
 */
export function calculateItemAnalysis(
  results: ScannedExamResult[],
  config: AnswerSheetConfig
): ItemAnalysisStat[] {
  if (results.length === 0) return [];

  const stats: ItemAnalysisStat[] = [];
  const choiceKeys = CHOICE_KEYS_ABCD.slice(0, config.choicesCount);

  for (let q = 1; q <= config.totalQuestions; q++) {
    const isBonus = Boolean(config.bonusQuestions?.[q]);
    const multi = config.multiAnswerKeys?.[q];
    const primaryKey = config.answerKeys[q] || 'A';
    const accepted = multi && multi.length > 0 ? multi : [primaryKey];
    const displayKey = isBonus ? 'FREE' : accepted.join('/');

    let correctCount = 0;
    let incorrectCount = 0;
    let blankCount = 0;
    let multipleCount = 0;
    const distribution: Record<string, number> = {};
    choiceKeys.forEach((k) => (distribution[k] = 0));

    results.forEach((r) => {
      const ans = r.detectedAnswers[q];
      if (isBonus) {
        correctCount++;
        if (ans && distribution[ans] !== undefined) {
          distribution[ans] = (distribution[ans] || 0) + 1;
        }
        return;
      }

      if (ans && accepted.includes(ans)) {
        correctCount++;
        distribution[ans] = (distribution[ans] || 0) + 1;
      } else if (ans === 'MULTIPLE') {
        multipleCount++;
        incorrectCount++;
      } else if (!ans) {
        blankCount++;
        incorrectCount++;
      } else {
        incorrectCount++;
        distribution[ans] = (distribution[ans] || 0) + 1;
      }
    });

    const totalAttempts = results.length;
    const difficultyIndex = totalAttempts > 0 ? Math.round((correctCount / totalAttempts) * 100) / 100 : 0;

    let difficultyLabel: ItemAnalysisStat['difficultyLabel'] = 'ปานกลาง';
    if (difficultyIndex < 0.2) difficultyLabel = 'ยากมาก';
    else if (difficultyIndex < 0.4) difficultyLabel = 'ค่อนข้างยาก';
    else if (difficultyIndex <= 0.6) difficultyLabel = 'ปานกลาง';
    else if (difficultyIndex <= 0.8) difficultyLabel = 'ค่อนข้างง่าย';
    else difficultyLabel = 'ง่ายมาก';

    stats.push({
      questionNumber: q,
      correctChoice: displayKey,
      totalAttempts,
      correctCount,
      incorrectCount,
      blankCount,
      multipleCount,
      choiceDistribution: distribution,
      difficultyIndex,
      difficultyLabel,
    });
  }

  return stats;
}
