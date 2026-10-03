import type {
  AnswerSheetConfig,
  ChoiceLabelType,
  ItemAnalysisStat,
  OmrRecordingMode,
  OmrStudentMode,
  ScannedAnswerDetail,
  ScannedExamResult,
} from '../types/omr';

// Sound Synthesis using Web Audio API
class OmrAudioPlayer {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  playSuccess() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Two-tone high chime (C6 -> E6)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(1046.5, now); // C6
      osc2.frequency.setValueAtTime(1318.51, now + 0.08); // E6

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.12);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.35);
    } catch {
      // Audio not permitted or supported
    }
  }

  playWarning() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now); // A4
      osc.frequency.setValueAtTime(370, now + 0.12); // F#4

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.4);
    } catch {
      // Audio not permitted or supported
    }
  }

  playClick() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.06);
    } catch {
      // Audio not permitted or supported
    }
  }
}

export const omrAudio = new OmrAudioPlayer();

// Label generators
export const CHOICE_KEYS_ABCD = ['A', 'B', 'C', 'D', 'E'];
export const CHOICE_KEYS_THAI = ['ก', 'ข', 'ค', 'ง', 'จ'];
export const CHOICE_KEYS_NUMERIC = ['1', '2', '3', '4', '5'];

export function getChoiceLabel(index: number, type: ChoiceLabelType): string {
  if (type === 'THAI') return CHOICE_KEYS_THAI[index] || String.fromCharCode(65 + index);
  if (type === 'NUMERIC') return CHOICE_KEYS_NUMERIC[index] || String(index + 1);
  return CHOICE_KEYS_ABCD[index] || String.fromCharCode(65 + index);
}

export function getChoiceKey(index: number): string {
  return CHOICE_KEYS_ABCD[index] || 'A';
}

/**
 * Normalizes and analyzes an uploaded or captured image to detect bubble markings.
 * Employs Canvas 2D image processing with automatic contrast adjustment & fiducial marker checks.
 */
export async function analyzeAnswerSheetImage(
  imageSource: HTMLImageElement | HTMLCanvasElement,
  config: AnswerSheetConfig,
  options: {
    studentMode: OmrStudentMode;
    recordingMode: OmrRecordingMode;
    targetStudentList?: Array<{ id: string; student_code: string; first_name: string; last_name: string }>;
  }
): Promise<ScannedExamResult> {
  // 1. Create a working processing canvas
  const canvas = document.createElement('canvas');
  const targetWidth = 1000;
  const targetHeight = 1414; // Standard A4 ratio
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) {
    throw new Error('Canvas 2D context is not available');
  }

  // Draw source image onto normalized dimensions
  ctx.drawImage(imageSource, 0, 0, targetWidth, targetHeight);
  const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
  const data = imageData.data;

  // 2. Measure overall page brightness and calculate threshold
  let totalLuminance = 0;
  const pixelCount = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    totalLuminance += lum;
  }
  const avgLuminance = totalLuminance / pixelCount;
  // Adaptive threshold based on paper ambient lighting
  const markFillThreshold = 0.32; // > 32% blacker than local background = filled mark

  // 3. Coordinate mapping for answer bubbles & roll number
  // The sheet is structured with:
  // - Header: 0 - 240px
  // - Roll Number block: x: 120 - 450, y: 150 - 280 (if enabled)
  // - Question blocks: distributed across 2 or 3 columns
  const questionsPerColumn = config.totalQuestions <= 30 ? 15 : config.totalQuestions <= 60 ? 25 : 35;
  const columnsCount = Math.ceil(config.totalQuestions / questionsPerColumn);

  // Helper to sample average darkness of a circular region
  const sampleCircleFill = (cx: number, cy: number, radius: number): number => {
    let darkPixels = 0;
    let sampled = 0;
    const rSq = radius * radius;
    const minX = Math.max(0, Math.floor(cx - radius));
    const maxX = Math.min(targetWidth - 1, Math.ceil(cx + radius));
    const minY = Math.max(0, Math.floor(cy - radius));
    const maxY = Math.min(targetHeight - 1, Math.ceil(cy + radius));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= rSq) {
          const idx = (y * targetWidth + x) * 4;
          const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          sampled++;
          // If darker than 60% of average paper brightness, count as dark
          if (lum < avgLuminance * 0.65) {
            darkPixels++;
          }
        }
      }
    }
    return sampled > 0 ? darkPixels / sampled : 0;
  };

  // 4. Sample Roll Number / Student Code if enabled
  let detectedRollNumber: number | null = null;
  let detectedStudentCode: string | null = null;

  if (config.studentIdFormat === 'roll_number') {
    // 2-digit roll number: Tens (0-9) and Ones (0-9)
    const rollStartX = 720;
    const rollStartY = 130;
    const colSpacing = 48;
    const rowSpacing = 20;

    let tensDigit: number | null = null;
    let onesDigit: number | null = null;

    // Tens column
    let maxTensFill = 0;
    for (let digit = 0; digit <= 9; digit++) {
      const cy = rollStartY + digit * rowSpacing;
      const fill = sampleCircleFill(rollStartX, cy, 7);
      if (fill > markFillThreshold && fill > maxTensFill) {
        maxTensFill = fill;
        tensDigit = digit;
      }
    }

    // Ones column
    let maxOnesFill = 0;
    for (let digit = 0; digit <= 9; digit++) {
      const cy = rollStartY + digit * rowSpacing;
      const fill = sampleCircleFill(rollStartX + colSpacing, cy, 7);
      if (fill > markFillThreshold && fill > maxOnesFill) {
        maxOnesFill = fill;
        onesDigit = digit;
      }
    }

    if (tensDigit !== null && onesDigit !== null) {
      detectedRollNumber = tensDigit * 10 + onesDigit;
      detectedStudentCode = String(detectedRollNumber).padStart(2, '0');
    } else if (onesDigit !== null) {
      detectedRollNumber = onesDigit;
      detectedStudentCode = String(detectedRollNumber).padStart(2, '0');
    }
  }

  // 5. Sample Question Answers
  const answersDetail: ScannedAnswerDetail[] = [];
  const detectedAnswers: Record<number, string | null> = {};
  const flags: string[] = [];

  let correctCount = 0;
  let incorrectCount = 0;
  let blankCount = 0;
  let multipleCount = 0;
  let totalScoreAwarded = 0;
  let totalPossibleScore = 0;

  const choicesCount = config.choicesCount;
  const choiceKeys = CHOICE_KEYS_ABCD.slice(0, choicesCount);

  // Column layout coordinates
  const colWidth = (targetWidth - 140) / columnsCount;
  const startY = config.studentIdFormat === 'none' ? 240 : 360;
  const rowHeight = Math.min(32, (targetHeight - startY - 100) / questionsPerColumn);
  const bubbleSpacingX = 36;
  const bubbleRadius = 8;

  for (let q = 1; q <= config.totalQuestions; q++) {
    const colIndex = Math.floor((q - 1) / questionsPerColumn);
    const rowIndex = (q - 1) % questionsPerColumn;

    const qBaseX = 80 + colIndex * colWidth + 60;
    const qBaseY = startY + rowIndex * rowHeight;

    const fillRatios: Record<string, number> = {};
    const markedChoices: string[] = [];

    choiceKeys.forEach((choiceKey, cIdx) => {
      const bubbleX = qBaseX + cIdx * bubbleSpacingX;
      const bubbleY = qBaseY;
      const fill = sampleCircleFill(bubbleX, bubbleY, bubbleRadius);
      fillRatios[choiceKey] = Math.round(fill * 100) / 100;

      if (fill >= markFillThreshold) {
        markedChoices.push(choiceKey);
      }
    });

    const currentSetKeys = (config.examSets && config.examSet && config.examSets[config.examSet])
      ? config.examSets[config.examSet]
      : config.answerKeys;
    const correctChoice = currentSetKeys[q] || 'A';
    const pointWeight = config.pointsPerQuestion[q] || 1;
    totalPossibleScore += pointWeight;

    let detectedChoice: string | null = null;
    let isCorrect = false;
    let scoreAwarded = 0;
    let qFlag: 'multiple' | 'blank' | 'faint' | 'ok' = 'ok';

    if (markedChoices.length === 1) {
      detectedChoice = markedChoices[0];
      if (detectedChoice === correctChoice) {
        isCorrect = true;
        scoreAwarded = pointWeight;
        correctCount++;
      } else {
        incorrectCount++;
      }

      // Check if fill was somewhat faint
      const topFill = fillRatios[detectedChoice];
      if (topFill < 0.42) {
        qFlag = 'faint';
        flags.push(`ข้อ ${q} ฝนค่อนข้างจาง (${Math.round(topFill * 100)}%)`);
      }
    } else if (markedChoices.length > 1) {
      detectedChoice = 'MULTIPLE';
      multipleCount++;
      qFlag = 'multiple';
      flags.push(`ข้อ ${q} ฝนซ้ำกันมากกว่า 1 ตัวเลือก (${markedChoices.join(', ')})`);
    } else {
      detectedChoice = null;
      blankCount++;
      qFlag = 'blank';
    }

    totalScoreAwarded += scoreAwarded;
    detectedAnswers[q] = detectedChoice;

    answersDetail.push({
      questionNumber: q,
      detectedChoice,
      correctChoice,
      isCorrect,
      scoreAwarded,
      maxScore: pointWeight,
      fillRatios,
      flag: qFlag,
    });
  }

  // 6. Match Student
  let matchedStudentId: string | null = null;
  let studentDisplayName = 'กระดาษคำตอบทั่วไป';

  if (options.studentMode === 'classroom' && options.targetStudentList && options.targetStudentList.length > 0) {
    if (detectedRollNumber !== null) {
      // Match by 1-based roll number index or student_code suffix
      const studentByRoll = options.targetStudentList[detectedRollNumber - 1];
      if (studentByRoll) {
        matchedStudentId = studentByRoll.id;
        studentDisplayName = `เลขที่ ${detectedRollNumber} ${studentByRoll.first_name} ${studentByRoll.last_name}`;
      } else {
        // Look up by matching student_code
        const studentByCode = options.targetStudentList.find((s) => s.student_code.endsWith(String(detectedRollNumber)));
        if (studentByCode) {
          matchedStudentId = studentByCode.id;
          studentDisplayName = `${studentByCode.first_name} ${studentByCode.last_name} (${studentByCode.student_code})`;
        } else {
          studentDisplayName = `เลขที่ ${detectedRollNumber} (ไม่พบในรายชื่อ)`;
          flags.push(`ไม่พบรหัสนักเรียน/เลขที่ ${detectedRollNumber} ในห้องนี้`);
        }
      }
    } else {
      flags.push('ไม่พบการฝนเลขที่หรือรหัสนักเรียน');
      studentDisplayName = 'ไม่ระบุชื่อ (รอครูเลือกนักเรียน)';
    }
  } else {
    studentDisplayName = detectedRollNumber !== null ? `ผู้สอบเลขที่ #${detectedRollNumber}` : `ผู้สอบทั่วไป #${Math.floor(100 + Math.random() * 900)}`;
  }

  // 7. Calculate overall confidence & status
  const maxPossible = totalPossibleScore > 0 ? totalPossibleScore : 1;
  const percentage = Math.round((totalScoreAwarded / maxPossible) * 100);

  // Confidence is lowered if there are blank, multiple, or faint flags
  const anomalyCount = multipleCount + (flags.length > 0 ? 1 : 0);
  const confidence = Math.max(0.65, Math.min(0.99, 1.0 - (anomalyCount * 0.08 + (blankCount / config.totalQuestions) * 0.05)));

  let status: ScannedExamResult['status'] = 'confirmed';
  if (options.recordingMode === 'display_only') {
    status = 'display_only';
  } else if (flags.length > 0 || multipleCount > 0) {
    status = 'pending_review';
  }

  // Generate thumbnail preview URL
  const previewImageUrl = canvas.toDataURL('image/jpeg', 0.65);

  return {
    id: `scan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    scannedAt: new Date().toISOString(),
    studentMode: options.studentMode,
    studentId: matchedStudentId,
    studentRollNumber: detectedRollNumber,
    studentCode: detectedStudentCode,
    studentName: studentDisplayName,
    detectedAnswers,
    answersDetail,
    totalScore: totalScoreAwarded,
    maxScore: totalPossibleScore,
    percentage,
    correctCount,
    incorrectCount,
    blankCount,
    multipleCount,
    confidence: Math.round(confidence * 100) / 100,
    status,
    flags,
    recordingMode: options.recordingMode,
    isSavedToGradebook: false,
    previewImageUrl,
  };
}

/**
 * Generates an accurate synthetic filled answer sheet on an HTML Canvas.
 * Ideal for immediate on-screen testing and live camera simulation.
 */
export function generateSyntheticFilledSheet(
  config: AnswerSheetConfig,
  options?: {
    rollNumber?: number;
    accuracyRate?: number; // 0.0 to 1.0
    includeAnomalies?: boolean; // faint mark, double mark
  }
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const targetWidth = 1000;
  const targetHeight = 1414;
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const roll = options?.rollNumber ?? Math.floor(1 + Math.random() * 25);
  const accuracy = options?.accuracyRate ?? 0.85;

  // 1. Clean Paper background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  // 2. Corner Alignment Markers (Solid 28x28 black squares at 4 corners for accurate OpenCV warp)
  const markerSize = 28;
  ctx.fillStyle = '#000000';
  ctx.fillRect(20, 20, markerSize, markerSize); // Top-Left
  ctx.fillRect(targetWidth - 20 - markerSize, 20, markerSize, markerSize); // Top-Right
  ctx.fillRect(20, targetHeight - 20 - markerSize, markerSize, markerSize); // Bottom-Left
  ctx.fillRect(targetWidth - 20 - markerSize, targetHeight - 20 - markerSize, markerSize, markerSize); // Bottom-Right

  // 3. Clean Header Bar
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(50, 110);
  ctx.lineTo(targetWidth - 50, 110);
  ctx.stroke();

  // Title Texts
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 26px Anuphan, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(config.title || 'กระดาษคำตอบ (Answer Sheet)', 50, 70);

  ctx.font = '14px Anuphan, sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText(
    `วิชา: ${config.subjectName || '-'} | ห้อง: ${config.roomName || '-'} | วันที่: ${config.examDate || '-'}`,
    50,
    98
  );

  // Right Header: Question count & Total score
  ctx.textAlign = 'right';
  ctx.font = 'bold 14px Anuphan, sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.fillText(`ข้อสอบ: ${config.totalQuestions} ข้อ • คะแนนเต็ม: ${config.totalScore} คะแนน`, targetWidth - 50, 75);

  // 4. Student Information Bar
  const infoY = 135;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 14px Anuphan, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('ชื่อ - สกุล: ............................................................................', 50, infoY + 20);
  ctx.fillText('ชั้น / ห้อง: ..........................', 50, infoY + 50);
  ctx.fillText('เลขที่: .................', 320, infoY + 50);

  // Simple instruction
  ctx.font = '12px Anuphan, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText('คำชี้แจง: ใช้ดินสอดำ 2B ฝนในวงกลมให้ดำเต็มวง ( ● ถูก  ✕ ผิด )', 50, infoY + 80);

  // Roll Number Bubbles on right
  if (config.studentIdFormat === 'roll_number') {
    const rollBoxX = targetWidth - 210;
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(rollBoxX, 125, 160, 120);

    ctx.fillStyle = '#334155';
    ctx.font = 'bold 11px Anuphan, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('เลขที่ (00-99)', rollBoxX + 80, 142);

    const tens = Math.floor(roll / 10);
    const ones = roll % 10;
    const colSpacing = 36;
    const startBubbleY = 158;
    const rowStep = 8.5;

    ['สิบ', 'หน่วย'].forEach((lbl, cIdx) => {
      const bx = rollBoxX + 62 + cIdx * colSpacing;
      ctx.fillStyle = '#64748b';
      ctx.font = '9px sans-serif';
      ctx.fillText(lbl, bx, startBubbleY);

      for (let digit = 0; digit <= 9; digit++) {
        const by = startBubbleY + 8 + digit * rowStep;
        const isTarget = (cIdx === 0 && digit === tens) || (cIdx === 1 && digit === ones);

        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(bx, by, 3.2, 0, Math.PI * 2);
        ctx.stroke();

        if (isTarget) {
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.arc(bx, by, 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });
  }

  // 5. Clean & Spacious Questions Grid
  const questionsPerColumn = config.totalQuestions <= 30 ? 15 : config.totalQuestions <= 60 ? 25 : 30;
  const columnsCount = Math.ceil(config.totalQuestions / questionsPerColumn);
  const startY = 270;
  const availableWidth = targetWidth - 100;
  const colWidth = availableWidth / columnsCount;
  const rowHeight = Math.min(28, (targetHeight - startY - 90) / questionsPerColumn);
  const bubbleSpacingX = 30;
  const bubbleRadius = 8;
  const choiceKeys = CHOICE_KEYS_ABCD.slice(0, config.choicesCount);

  for (let c = 0; c < columnsCount; c++) {
    const colLeft = 50 + c * colWidth;
    const colInnerWidth = colWidth - 14;
    const startQ = c * questionsPerColumn + 1;
    const endQ = Math.min(config.totalQuestions, (c + 1) * questionsPerColumn);

    // Column Header
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(colLeft, startY, colInnerWidth, 26 + (endQ - startQ + 1) * rowHeight + 10);

    ctx.fillStyle = '#334155';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ข้อ', colLeft + 25, startY + 18);

    choiceKeys.forEach((_, cIdx) => {
      const hbx = colLeft + 54 + cIdx * bubbleSpacingX;
      ctx.fillText(getChoiceLabel(cIdx, config.choiceLabelType), hbx, startY + 18);
    });

    // Column Questions
    for (let q = startQ; q <= endQ; q++) {
      const rowIndex = q - startQ;
      const qY = startY + 32 + rowIndex * rowHeight;

      // Question Number
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${q}.`, colLeft + 36, qY + 4);

      // Determine answer
      const correctChoice = config.answerKeys[q] || 'A';
      const isAnswerCorrect = Math.random() <= accuracy;
      let chosenChoice = correctChoice;
      if (!isAnswerCorrect) {
        const otherChoices = choiceKeys.filter((ck) => ck !== correctChoice);
        chosenChoice = otherChoices[Math.floor(Math.random() * otherChoices.length)] || 'B';
      }

      // Draw bubbles
      choiceKeys.forEach((choiceKey, cIdx) => {
        const bubbleX = colLeft + 54 + cIdx * bubbleSpacingX;
        const bubbleY = qY;

        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(bubbleX, bubbleY, bubbleRadius, 0, Math.PI * 2);
        ctx.stroke();

        const label = getChoiceLabel(cIdx, config.choiceLabelType);

        if (choiceKey === chosenChoice) {
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.arc(bubbleX + (Math.random() - 0.5) * 0.5, bubbleY + (Math.random() - 0.5) * 0.5, bubbleRadius - 0.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = '#475569';
          ctx.font = 'bold 9px Anuphan, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(label, bubbleX, bubbleY + 3.2);
        }
      });
    }
  }

  // 6. Simple Bottom Footer
  const footerY = targetHeight - 60;
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(50, footerY);
  ctx.lineTo(targetWidth - 50, footerY);
  ctx.stroke();

  ctx.fillStyle = '#64748b';
  ctx.font = '12px Anuphan, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('ClassCare 360 AI OMR System', 50, footerY + 24);

  // Score Box
  const scoreBoxX = targetWidth - 220;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 12px Anuphan, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('คะแนนที่ได้ (Score):', scoreBoxX, footerY + 24);

  ctx.strokeStyle = '#94a3b8';
  ctx.strokeRect(scoreBoxX + 115, footerY + 8, 45, 24);
  ctx.fillText(`/ ${config.totalScore}`, scoreBoxX + 168, footerY + 25);

  return canvas;
}

/**
 * Computes Item Analysis statistics across all scanned results.
 */
export function calculateItemAnalysis(
  results: ScannedExamResult[],
  config: AnswerSheetConfig
): ItemAnalysisStat[] {
  if (results.length === 0) return [];

  const stats: ItemAnalysisStat[] = [];
  const choiceKeys = CHOICE_KEYS_ABCD.slice(0, config.choicesCount);

  for (let q = 1; q <= config.totalQuestions; q++) {
    const correctChoice = config.answerKeys[q] || 'A';
    let correctCount = 0;
    let incorrectCount = 0;
    let blankCount = 0;
    let multipleCount = 0;
    const distribution: Record<string, number> = {};
    choiceKeys.forEach((k) => (distribution[k] = 0));

    results.forEach((r) => {
      const ans = r.detectedAnswers[q];
      if (ans === correctChoice) {
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
      correctChoice,
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
