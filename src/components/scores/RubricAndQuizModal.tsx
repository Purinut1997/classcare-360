import { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  FileCheck2,
  FileText,
  GraduationCap,
  HelpCircle,
  Layers,
  Lightbulb,
  Loader2,
  Plus,
  Printer,
  RefreshCw,
  Sliders,
  Sparkles,
  Table,
  Trash2,
  X,
} from 'lucide-react';
import { ContextLink as Link } from '../navigation/ContextLink';
import { getEffectiveAiConfig } from '../../lib/aiSettings';
import {
  analyzeIndicatorsFromUnits,
  generateRemedialQuiz,
  generateRubricCriteria,
  generateSemesterExam,
  type ExamIndicatorQuota,
  type QuizChoiceType,
  type RemedialQuizResult,
  type RubricResult,
  type SemesterExamResult,
  type SemesterExamType,
} from '../../lib/aiVisionService';
import type { AppSessionContext } from '../../types/core';

export interface ExamUnitItem {
  id: string;
  name: string;
}

export interface ExamIndicatorItem {
  id: string;
  code: string;
  name: string;
  unitName?: string;
  count: number;
}

interface RubricAndQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSubject: string;
  defaultGradeLevel?: string;
  session: AppSessionContext;
}

type ActiveTab = 'rubric' | 'quiz' | 'exam';

export function RubricAndQuizModal({
  isOpen,
  onClose,
  defaultSubject,
  defaultGradeLevel = 'ป.5',
  session,
}: RubricAndQuizModalProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('rubric');
  const [subject, setSubject] = useState(defaultSubject || 'คณิตศาสตร์');
  const [gradeLevel, setGradeLevel] = useState(defaultGradeLevel);
  const [indicator, setIndicator] = useState('ค 1.1 ป.5/1');
  const [taskDescription, setTaskDescription] = useState('การแก้โจทย์ปัญหาเศษส่วนและจำนวนคละ 2 ขั้นตอน');
  const [focusTopics, setFocusTopics] = useState('การบวก ลบ เศษส่วนที่ตัวส่วนไม่เท่ากัน');
  const [questionCount, setQuestionCount] = useState(5);
  const [choiceType, setChoiceType] = useState<QuizChoiceType>('4-choices');

  // Semester Exam states
  const [examType, setExamType] = useState<SemesterExamType>('midterm');
  const [academicYear, setAcademicYear] = useState('2568');
  const [semester, setSemester] = useState('2');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [totalScore, setTotalScore] = useState(20);
  const [examTopics, setExamTopics] = useState('การบวก ลบ คูณ หารเศษส่วน และโจทย์ปัญหาระคน');
  const [examPart1Count, setExamPart1Count] = useState(15);
  const [examPart1ChoiceType, setExamPart1ChoiceType] = useState<'4-choices' | '5-choices'>('4-choices');
  const [examIncludePart2, setExamIncludePart2] = useState(true);
  const [examPart2Count, setExamPart2Count] = useState(2);
  const [examDifficulty, setExamDifficulty] = useState<'balanced' | 'basic' | 'advanced'>('balanced');
  const [examViewSubTab, setExamViewSubTab] = useState<'paper' | 'key' | 'blueprint'>('paper');

  // Semester Exam: Multi-Unit & Indicator Analysis States
  const [examUnits, setExamUnits] = useState<ExamUnitItem[]>([
    { id: 'u-1', name: 'หน่วยที่ 1 การบวก ลบ คูณ หารเศษส่วน และจำนวนคละ' },
    { id: 'u-2', name: 'หน่วยที่ 2 ทศนิยม และการบวก ลบ คูณ หารทศนิยม' },
  ]);
  const [newUnitInput, setNewUnitInput] = useState('');

  const [examIndicators, setExamIndicators] = useState<ExamIndicatorItem[]>([
    {
      id: 'ind-1',
      code: 'ค 1.1 ป.5/3',
      name: 'หาผลบวก ผลลบของเศษส่วนและจำนวนคละ',
      unitName: 'หน่วยที่ 1 การบวก ลบ คูณ หารเศษส่วน และจำนวนคละ',
      count: 6,
    },
    {
      id: 'ind-2',
      code: 'ค 1.1 ป.5/5',
      name: 'แสดงวิธีหาคำตอบของโจทย์ปัญหาการบวก การลบ การคูณ การหารเศษส่วน 2 ขั้นตอน',
      unitName: 'หน่วยที่ 1 การบวก ลบ คูณ หารเศษส่วน และจำนวนคละ',
      count: 6,
    },
    {
      id: 'ind-3',
      code: 'ค 1.1 ป.5/1',
      name: 'เขียนเศษส่วนที่มีตัวส่วนเป็นตัวประกอบของ 10 หรือ 100 หรือ 1,000 ในรูปทศนิยม',
      unitName: 'หน่วยที่ 2 ทศนิยม และการบวก ลบ คูณ หารทศนิยม',
      count: 5,
    },
  ]);
  const [isAnalyzingIndicators, setIsAnalyzingIndicators] = useState(false);
  const [indicatorMode, setIndicatorMode] = useState<'balanced' | 'custom'>('balanced');
  const [showIndicatorInStudentPaper, setShowIndicatorInStudentPaper] = useState(true);
  const [isAddingIndicatorManual, setIsAddingIndicatorManual] = useState(false);
  const [manualIndCode, setManualIndCode] = useState('');
  const [manualIndName, setManualIndName] = useState('');
  const [manualIndUnit, setManualIndUnit] = useState('');

  const totalExamQuestions = examPart1Count + (examIncludePart2 ? examPart2Count : 0);
  const totalAllocatedQuestions = examIndicators.reduce(
    (acc, curr) => acc + (Number(curr.count) || 0),
    0
  );

  const rebalanceIndicators = (indicators: ExamIndicatorItem[], total: number) => {
    if (indicators.length === 0) return indicators;
    const base = Math.floor(total / indicators.length);
    const remainder = total % indicators.length;
    return indicators.map((ind, i) => ({
      ...ind,
      count: Math.max(1, base + (i < remainder ? 1 : 0)),
    }));
  };

  const handleAddUnit = () => {
    const trimmed = newUnitInput.trim();
    if (!trimmed) return;
    setExamUnits((prev) => [...prev, { id: `u-${Date.now()}`, name: trimmed }]);
    setNewUnitInput('');
  };

  const handleRemoveUnit = (id: string) => {
    setExamUnits((prev) => prev.filter((u) => u.id !== id));
  };

  const handleAnalyzeIndicators = async () => {
    if (examUnits.length === 0) {
      setErrorMessage('กรุณาเพิ่มหน่วยการเรียนรู้อย่างน้อย 1 หน่วยก่อนให้ AI วิเคราะห์');
      return;
    }
    setIsAnalyzingIndicators(true);
    setErrorMessage(null);
    try {
      const config = await getEffectiveAiConfig(session);
      if (!config.apiKey) {
        throw new Error('ไม่พบ Gemini API Key ในระบบ กรุณาตั้งค่าก่อนใช้งาน');
      }
      const result = await analyzeIndicatorsFromUnits({
        apiKey: config.apiKey,
        model: config.model,
        subject,
        gradeLevel,
        units: examUnits.map((u) => u.name),
      });
      if (!result || result.length === 0) {
        throw new Error(
          'ไม่พบตัวชี้วัดที่สอดคล้องกับหน่วยที่ระบุ กรุณาระบุชื่อหน่วยให้ชัดเจนยิ่งขึ้น หรือเพิ่มตัวชี้วัดด้วยตนเอง'
        );
      }
      const targetTotal = examPart1Count + (examIncludePart2 ? examPart2Count : 0);
      const base = Math.floor(targetTotal / result.length);
      const remainder = targetTotal % result.length;
      const newItems: ExamIndicatorItem[] = result.map((item, idx) => ({
        id: `ind-${Date.now()}-${idx}`,
        code: item.code,
        name: item.name,
        unitName: item.unitName || examUnits[0]?.name || '',
        count: Math.max(1, base + (idx < remainder ? 1 : 0)),
      }));
      setExamIndicators(newItems);
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setIsAnalyzingIndicators(false);
    }
  };

  const handleAddManualIndicator = () => {
    if (!manualIndCode.trim()) return;
    const targetTotal = examPart1Count + (examIncludePart2 ? examPart2Count : 0);
    const newItem: ExamIndicatorItem = {
      id: `ind-${Date.now()}`,
      code: manualIndCode.trim(),
      name: manualIndName.trim() || 'ตัวชี้วัด สพฐ. ที่กำหนดเอง',
      unitName: manualIndUnit || examUnits[0]?.name || 'หน่วยทั่วไป',
      count: 2,
    };
    const updated = [...examIndicators, newItem];
    if (indicatorMode === 'balanced') {
      setExamIndicators(rebalanceIndicators(updated, targetTotal));
    } else {
      setExamIndicators(updated);
    }
    setManualIndCode('');
    setManualIndName('');
    setIsAddingIndicatorManual(false);
  };

  const handleUpdateIndicatorCount = (id: string, newCount: number) => {
    setExamIndicators((prev) =>
      prev.map((ind) => (ind.id === id ? { ...ind, count: Math.max(1, newCount) } : ind))
    );
  };

  const handleRemoveIndicator = (id: string) => {
    const updated = examIndicators.filter((ind) => ind.id !== id);
    if (indicatorMode === 'balanced') {
      setExamIndicators(rebalanceIndicators(updated, totalExamQuestions));
    } else {
      setExamIndicators(updated);
    }
  };

  const [isGenerating, setIsGenerating] = useState(false);
  const [rubricResult, setRubricResult] = useState<RubricResult | null>(null);
  const [quizResult, setQuizResult] = useState<RemedialQuizResult | null>(null);
  const [examResult, setExamResult] = useState<SemesterExamResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  const checkApiKey = async () => {
    try {
      const config = await getEffectiveAiConfig(session);
      setHasApiKey(Boolean(config.apiKey));
    } catch {
      setHasApiKey(false);
    }
  };

  if (!isOpen) return null;
  if (hasApiKey === null) {
    void checkApiKey();
  }

  const handleGenerateRubric = async () => {
    setIsGenerating(true);
    setErrorMessage(null);
    try {
      const config = await getEffectiveAiConfig(session);
      if (!config.apiKey) {
        throw new Error('ไม่พบ Gemini API Key ในระบบ กรุณาตั้งค่าก่อนใช้งาน');
      }
      const res = await generateRubricCriteria(
        config.apiKey,
        config.model,
        subject,
        gradeLevel,
        indicator,
        taskDescription
      );
      setRubricResult(res);
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateQuiz = async () => {
    setIsGenerating(true);
    setErrorMessage(null);
    try {
      const config = await getEffectiveAiConfig(session);
      if (!config.apiKey) {
        throw new Error('ไม่พบ Gemini API Key ในระบบ กรุณาตั้งค่าก่อนใช้งาน');
      }
      const res = await generateRemedialQuiz(
        config.apiKey,
        config.model,
        subject,
        gradeLevel,
        indicator,
        focusTopics,
        questionCount,
        choiceType
      );
      setQuizResult(res);
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateExam = async () => {
    setIsGenerating(true);
    setErrorMessage(null);
    try {
      const config = await getEffectiveAiConfig(session);
      if (!config.apiKey) {
        throw new Error('ไม่พบ Gemini API Key ในระบบ กรุณาตั้งค่าก่อนใช้งาน');
      }
      const unitNames = examUnits.map((u) => u.name);
      const indicatorSummary =
        examIndicators.length > 0
          ? examIndicators.map((ind) => `${ind.code} (${ind.name}) [เป้าหมาย ${ind.count} ข้อ]`).join('; ')
          : indicator;

      const res = await generateSemesterExam({
        apiKey: config.apiKey,
        model: config.model,
        examType,
        subject,
        gradeLevel,
        academicYear,
        term: semester,
        timeMinutes: durationMinutes,
        totalScore,
        topicsCovered: unitNames.join(', ') || examTopics,
        units: unitNames,
        indicatorQuotas: examIndicators.map((ind) => ({
          code: ind.code,
          name: ind.name,
          count: Number(ind.count) || 1,
          unitName: ind.unitName,
        })),
        indicators: indicatorSummary,
        multipleChoiceCount: examPart1Count,
        choiceType: examPart1ChoiceType,
        includeSubjective: examIncludePart2,
        subjectiveCount: examPart2Count,
        difficultyRatio:
          examDifficulty === 'balanced'
            ? '30:50:20'
            : examDifficulty === 'basic'
            ? '50:40:10'
            : '30:40:30',
      });
      setExamResult(res);
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopyNotice(`คัดลอก ${label} ลงคลิปบอร์ดแล้ว`);
    setTimeout(() => setCopyNotice(null), 2500);
  };

  const printExamDocument = (result: SemesterExamResult, mode: 'student' | 'teacher') => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('กรุณาอนุญาตป๊อปอัป (Pop-up) ของเบราว์เซอร์เพื่อพิมพ์ข้อสอบ');
      return;
    }

    const title =
      mode === 'student'
        ? `${result.examTitle} - สำหรับแจกนักเรียน`
        : `${result.examTitle} - ชุดเฉลยละเอียดและผังวิเคราะห์ (สำหรับครู)`;

    const studentHtml = `
      <!DOCTYPE html>
      <html lang="th">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          @page { size: A4 portrait; margin: 15mm 12mm 15mm 12mm; }
          body {
            font-family: 'Sarabun', 'TH Sarabun New', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 13pt;
            line-height: 1.45;
            color: #000;
            padding: 16px;
            max-width: 800px;
            margin: 0 auto;
          }
          .exam-header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
          .exam-title { font-size: 15pt; font-weight: bold; margin-bottom: 4px; }
          .exam-sub { font-size: 12pt; margin-bottom: 4px; }
          .exam-meta { font-size: 11pt; margin-top: 4px; }
          .student-box {
            border: 1.5px solid #000;
            border-radius: 6px;
            padding: 8px 12px;
            margin-bottom: 12px;
            font-size: 11pt;
            display: flex;
            justify-content: space-between;
          }
          .instructions-box {
            background-color: #f8f9fa;
            border: 1px solid #ccc;
            border-radius: 6px;
            padding: 8px 12px;
            font-size: 10.5pt;
            margin-bottom: 14px;
          }
          .part-title {
            font-weight: bold;
            font-size: 12pt;
            background: #f1f3f5;
            padding: 5px 10px;
            border-left: 5px solid #222;
            margin: 16px 0 10px 0;
          }
          .q-item { margin-bottom: 12px; page-break-inside: avoid; }
          .q-text { font-weight: bold; font-size: 11.5pt; margin-bottom: 4px; }
          .choices-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 4px 16px;
            padding-left: 18px;
            font-size: 11pt;
          }
          .subjective-item { margin-bottom: 16px; page-break-inside: avoid; }
          .work-box {
            border: 1px dashed #666;
            border-radius: 6px;
            min-height: 120px;
            margin-top: 6px;
            padding: 8px;
            font-size: 10pt;
            color: #888;
          }
          .page-footer { text-align: center; font-size: 10pt; color: #555; margin-top: 24px; border-top: 1px dashed #aaa; padding-top: 8px; }
        </style>
      </head>
      <body>
        <div class="exam-header">
          <div class="exam-title">${result.examTitle}</div>
          <div class="exam-sub">กลุ่มสาระการเรียนรู้${result.subject} ชั้น${result.gradeLevel} ภาคเรียนที่ ${result.term} ปีการศึกษา ${result.academicYear}</div>
          <div class="exam-meta">เวลาสอบ ${result.timeMinutes} นาที • คะแนนเต็ม ${result.totalScore} คะแนน</div>
        </div>

        <div class="student-box">
          <div>ชื่อ-นามสกุล: ............................................................................................</div>
          <div>ชั้น: ............ เลขที่: ........ ห้อง: ........</div>
        </div>

        <div class="instructions-box">
          <strong>คำชี้แจงทั่วไป:</strong> ${result.instructions}
        </div>

        <div class="part-title">${result.part1.title} (${result.part1.itemCount} ข้อ • ข้อละ ${result.part1.scorePerItem} คะแนน รวม ${result.part1.totalScore} คะแนน)</div>
        <div class="questions-list">
          ${result.part1.questions
            .map(
              (q) => `
            <div class="q-item">
              <div class="q-text">${q.questionNumber}. ${q.questionText} ${showIndicatorInStudentPaper && q.indicator ? `<span style="font-weight: normal; font-size: 10pt; color: #495057; margin-left: 6px;">[ตัวชี้วัด ${q.indicator}]</span>` : ''}</div>
              <div class="choices-grid">
                ${q.choices.map((c) => `<div><strong>${c.key}.</strong> ${c.text}</div>`).join('')}
              </div>
            </div>
          `
            )
            .join('')}
        </div>

        ${
          result.part2 && result.part2.questions && result.part2.questions.length > 0
            ? `
          <div class="part-title" style="margin-top: 20px;">${result.part2.title} (${result.part2.itemCount} ข้อ • รวม ${result.part2.totalScore} คะแนน)</div>
          <div class="subjective-list">
            ${result.part2.questions
              .map(
                (q) => `
              <div class="subjective-item">
                <div class="q-text">ข้อที่ ${q.questionNumber}. ${q.questionText} <span style="font-weight: normal; color: #555;">(${q.maxScore} คะแนน)</span> ${showIndicatorInStudentPaper && q.indicator ? `<span style="font-weight: normal; font-size: 10pt; color: #495057; margin-left: 6px;">[ตัวชี้วัด ${q.indicator}]</span>` : ''}</div>
                <div class="work-box">วิธีทำ / คำตอบ:</div>
              </div>
            `
              )
              .join('')}
          </div>
        `
            : ''
        }

        <div class="page-footer">
          *** สิ้นสุดแบบทดสอบ กรุณาตรวจสอบความเรียบร้อยก่อนส่งข้อสอบ ***
        </div>
      </body>
      </html>
    `;

    const teacherHtml = `
      <!DOCTYPE html>
      <html lang="th">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          @page { size: A4 portrait; margin: 15mm 12mm 15mm 12mm; }
          body {
            font-family: 'Sarabun', 'TH Sarabun New', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 11pt;
            line-height: 1.4;
            color: #000;
            padding: 16px;
            max-width: 850px;
            margin: 0 auto;
          }
          .exam-header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
          .exam-title { font-size: 14pt; font-weight: bold; }
          .badge-teacher { display: inline-block; background: #c92a2a; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 9.5pt; font-weight: bold; margin-top: 4px; }
          .part-title { font-weight: bold; font-size: 11.5pt; background: #f1f3f5; padding: 5px 10px; border-left: 5px solid #2b8a3e; margin: 16px 0 8px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 9.5pt; }
          th, td { border: 1px solid #444; padding: 5px 7px; text-align: left; vertical-align: top; }
          th { background: #f8f9fa; font-weight: bold; }
          .correct-key { font-size: 11pt; font-weight: bold; color: #2b8a3e; }
          .subjective-card { border: 1px solid #ccc; border-radius: 6px; padding: 8px 10px; margin-bottom: 8px; background: #fafafa; }
          .criteria-item { margin-top: 3px; padding-left: 8px; border-left: 2px solid #339af0; font-size: 9pt; }
        </style>
      </head>
      <body>
        <div class="exam-header">
          <div class="exam-title">[เอกสารสำหรับครู] เฉลยละเอียด & ผังวิเคราะห์ข้อสอบ (Test Blueprint)</div>
          <div>${result.examTitle} • วิชา${result.subject} ชั้น${result.gradeLevel}</div>
          <div class="badge-teacher">เฉพาะครูผู้สอน / กรรมการวัดผลและประเมินผลการเรียนรู้</div>
        </div>

        <div class="part-title">1. ตารางเฉลยข้อสอบปรนัย (ตอนที่ 1)</div>
        <table>
          <thead>
            <tr>
              <th style="width: 45px; text-align: center;">ข้อที่</th>
              <th style="width: 50px; text-align: center;">เฉลย</th>
              <th style="width: 100px;">ตัวชี้วัด</th>
              <th style="width: 110px;">ระดับพฤติกรรม (Bloom)</th>
              <th>คำอธิบาย / เหตุผลเฉลย</th>
            </tr>
          </thead>
          <tbody>
            ${result.part1.questions
              .map(
                (q) => `
              <tr>
                <td style="text-align: center; font-weight: bold;">${q.questionNumber}</td>
                <td style="text-align: center;" class="correct-key">${q.correctAnswer}</td>
                <td>${q.indicator || '-'}</td>
                <td>${q.bloomLevel || '-'}</td>
                <td>${q.explanation}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>

        ${
          result.part2 && result.part2.questions && result.part2.questions.length > 0
            ? `
          <div class="part-title">2. แนวคำตอบและเกณฑ์การให้คะแนนอัตนัย (ตอนที่ 2)</div>
          ${result.part2.questions
            .map(
              (q) => `
            <div class="subjective-card">
              <div style="font-weight: bold;">ข้อที่ ${q.questionNumber}. ${q.questionText} (${q.maxScore} คะแนน)</div>
              <div style="margin-top: 4px; color: #2b8a3e;"><strong>แนวคำตอบ / วิธีทำที่ถูกต้อง:</strong> ${q.sampleAnswer}</div>
              <div style="margin-top: 6px; font-weight: bold; font-size: 9.5pt;">เกณฑ์การให้คะแนน:</div>
              <div class="criteria-item">${q.scoringCriteria}</div>
            </div>
          `
            )
            .join('')}
        `
            : ''
        }

        <div class="part-title">3. ตารางผังวิเคราะห์ข้อสอบ (Test Blueprint) สำหรับส่งฝ่ายวิชาการ</div>
        <table>
          <thead>
            <tr>
              <th>สาระ / หน่วยการเรียนรู้</th>
              <th>ตัวชี้วัด สพฐ.</th>
              <th style="text-align: center; width: 60px;">ปรนัย</th>
              <th style="text-align: center; width: 60px;">อัตนัย</th>
              <th style="text-align: center; width: 60px;">รวมคะแนน</th>
              <th>การกระจายระดับพฤติกรรม (Bloom)</th>
            </tr>
          </thead>
          <tbody>
            ${result.blueprint
              .map(
                (bp) => `
              <tr>
                <td style="font-weight: bold;">${bp.unitName}</td>
                <td>${bp.indicator}</td>
                <td style="text-align: center;">${bp.multipleChoiceCount} ข้อ</td>
                <td style="text-align: center;">${bp.subjectiveCount} ข้อ</td>
                <td style="text-align: center; font-weight: bold;">${bp.totalScore}</td>
                <td>${bp.bloomDistribution}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const htmlToPrint = mode === 'student' ? studentHtml : teacherHtml;
    printWindow.document.open();
    printWindow.document.write(htmlToPrint);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 350);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-violet-500/10 via-white to-transparent px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-violet-400 text-white shadow-md">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">
                ✨ ศูนย์ออกแบบข้อสอบ & รูบริก สพฐ. (Assessment & Exam Paper Hub)
              </h3>
              <p className="text-xs font-bold text-slate-500">
                ออกแบบเกณฑ์รูบริก 4 ระดับ, ข้อสอบซ่อมเสริม และข้อสอบกลางภาค/ปลายภาคพร้อม Test Blueprint ในคลิกเดียว
              </p>
            </div>
          </div>
          <button
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            onClick={onClose}
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-100 bg-slate-50/70 px-6 overflow-x-auto">
          <button
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs sm:text-sm font-black transition shrink-0 ${
              activeTab === 'rubric'
                ? 'border-violet-600 text-violet-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
            onClick={() => {
              setActiveTab('rubric');
              setErrorMessage(null);
            }}
            type="button"
          >
            <FileCheck2 size={16} />
            <span>1. เกณฑ์รูบริก 4 ระดับ (Rubric)</span>
          </button>
          <button
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs sm:text-sm font-black transition shrink-0 ${
              activeTab === 'quiz'
                ? 'border-violet-600 text-violet-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
            onClick={() => {
              setActiveTab('quiz');
              setErrorMessage(null);
            }}
            type="button"
          >
            <GraduationCap size={16} />
            <span>2. ข้อสอบซ่อมเสริม (Remedial Quiz)</span>
          </button>
          <button
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs sm:text-sm font-black transition shrink-0 ${
              activeTab === 'exam'
                ? 'border-violet-600 text-violet-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
            onClick={() => {
              setActiveTab('exam');
              setErrorMessage(null);
            }}
            type="button"
          >
            <BookOpen size={16} />
            <span>3. ข้อสอบกลางภาค / ปลายภาค (Semester Exam)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Missing API Key Warning */}
          {hasApiKey === false && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <AlertCircle className="mt-0.5 shrink-0 text-amber-600" size={18} />
              <div>
                <p className="font-bold">ยังไม่ได้ตั้งค่า Gemini API Key</p>
                <p className="text-xs text-amber-700 mt-1">
                  ระบบต้องการ Gemini API Key เพื่อสร้างเกณฑ์และแบบทดสอบซ่อมเสริม
                </p>
                <Link
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-black text-amber-800 underline hover:text-amber-950"
                  to="/app/dashboard?view=workspace-settings"
                >
                  ไปที่หน้าตั้งค่าระบบเพื่อใส่ API Key <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          )}

          {copyNotice && (
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 animate-in fade-in">
              <CheckCircle2 size={15} className="text-emerald-600" />
              <span>{copyNotice}</span>
            </div>
          )}

          {errorMessage && (
            <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-bold text-rose-800">
              <AlertCircle className="shrink-0 text-rose-600" size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Required Fields Banner */}
          <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50/70 px-4 py-2.5 text-xs text-rose-900 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-black text-white shadow-xs">*</span>
              <span className="font-black text-rose-950">
                ช่องที่มีป้าย <span className="rounded bg-rose-200/80 px-1.5 py-0.5 text-[10px] font-black text-rose-800">จำเป็น *</span> ต้องระบุข้อมูลให้ครบถ้วนเพื่อให้ AI ออกแบบเนื้อหาได้ตรงหลักสูตร
              </span>
            </div>
            <span className="hidden sm:inline text-[11px] font-bold text-rose-700/80">ระบบ สพฐ. มาตรฐาน</span>
          </div>

          {/* Form Inputs */}
          <div className="grid gap-3 sm:grid-cols-3 rounded-2xl border-2 border-slate-200 bg-slate-50/70 p-4 shadow-xs">
            <label className="grid gap-1.5 text-xs font-black text-slate-800">
              <div className="flex items-center justify-between">
                <span>วิชา</span>
                <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-black text-rose-700 border border-rose-200">จำเป็น *</span>
              </div>
              <input
                className={`h-10 rounded-xl border-2 px-3 font-bold text-slate-900 shadow-xs transition focus:outline-none ${
                  !subject.trim()
                    ? 'border-rose-300 bg-rose-50/30 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                    : 'border-slate-300 bg-white focus:border-violet-500 focus:ring-2 focus:ring-violet-200'
                }`}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="เช่น คณิตศาสตร์"
                value={subject}
              />
            </label>
            <label className="grid gap-1.5 text-xs font-black text-slate-800">
              <div className="flex items-center justify-between">
                <span>ระดับชั้น</span>
                <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-black text-rose-700 border border-rose-200">จำเป็น *</span>
              </div>
              <input
                className={`h-10 rounded-xl border-2 px-3 font-bold text-slate-900 shadow-xs transition focus:outline-none ${
                  !gradeLevel.trim()
                    ? 'border-rose-300 bg-rose-50/30 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                    : 'border-slate-300 bg-white focus:border-violet-500 focus:ring-2 focus:ring-violet-200'
                }`}
                onChange={(e) => setGradeLevel(e.target.value)}
                placeholder="เช่น ป.5 หรือ ม.2"
                value={gradeLevel}
              />
            </label>
            {activeTab !== 'exam' ? (
              <label className="grid gap-1.5 text-xs font-black text-slate-800">
                <div className="flex items-center justify-between">
                  <span>ตัวชี้วัด สพฐ.</span>
                  <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-black text-rose-700 border border-rose-200">จำเป็น *</span>
                </div>
                <input
                  className={`h-10 rounded-xl border-2 px-3 font-bold text-slate-900 shadow-xs transition focus:outline-none ${
                    !indicator.trim()
                      ? 'border-rose-300 bg-rose-50/30 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                      : 'border-slate-300 bg-white focus:border-violet-500 focus:ring-2 focus:ring-violet-200'
                  }`}
                  onChange={(e) => setIndicator(e.target.value)}
                  placeholder="เช่น ค 1.1 ป.5/1 หรือ ว 1.2 ม.2/1"
                  value={indicator}
                />
              </label>
            ) : (
              <div className="flex flex-col justify-center rounded-xl bg-violet-50/80 border border-violet-200 p-2.5 text-xs text-violet-900">
                <div className="flex items-center gap-1 text-[11px] font-black text-violet-800">
                  <Sparkles size={13} className="text-violet-600" />
                  <span>หน่วย & ตัวชี้วัดหลายหน่วย</span>
                </div>
                <p className="text-[10.5px] text-violet-700 mt-0.5 font-medium leading-tight">
                  สำหรับข้อสอบกลางภาค/ปลายภาค ให้ใส่หน่วยการเรียนรู้และให้ AI วิเคราะห์ตัวชี้วัดในหัวข้อด้านล่าง
                </p>
              </div>
            )}
          </div>

          {/* TAB 1: Rubric Generator */}
          {activeTab === 'rubric' && (
            <div className="space-y-4">
              <label className="grid gap-1.5 text-xs font-black text-slate-800">
                <div className="flex items-center justify-between">
                  <span>ลักษณะงาน / ชิ้นงานที่จะประเมิน</span>
                  <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-black text-rose-700 border border-rose-200">จำเป็น *</span>
                </div>
                <input
                  className={`h-10 rounded-xl border-2 px-3 font-bold text-slate-900 shadow-xs transition focus:outline-none ${
                    !taskDescription.trim()
                      ? 'border-rose-300 bg-rose-50/30 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                      : 'border-slate-300 bg-white focus:border-violet-500 focus:ring-2 focus:ring-violet-200'
                  }`}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="เช่น ใบงานการแก้โจทย์ปัญหา, รายงานการทดลองวิทยาศาสตร์, การเขียนเรียงความ"
                  value={taskDescription}
                />
              </label>

              {!rubricResult ? (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-violet-300 bg-violet-50/30 p-8 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                    <FileCheck2 size={24} />
                  </div>
                  <p className="text-sm font-black text-slate-900">
                    คลิกปุ่มด้านล่างเพื่อสร้างเกณฑ์ Rubrics 4 ระดับ (สพฐ.) อัตโนมัติ
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    ระดับ 4 (ดีเยี่ยม), ระดับ 3 (ดี), ระดับ 2 (พอใช้/ผ่าน), ระดับ 1 (ปรับปรุง)
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-base font-black text-slate-900">{rubricResult.title}</h4>
                      <p className="text-xs text-slate-500">
                        {rubricResult.subject} • {rubricResult.indicator}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50"
                        onClick={() => {
                          const formatted = rubricResult.criteria
                            .map((c) => `[${c.dimension}]\n` + c.levels.map((l) => `- ระดับ ${l.level} (${l.label}): ${l.description}`).join('\n'))
                            .join('\n\n');
                          handleCopyText(`${rubricResult.title}\nตัวชี้วัด: ${rubricResult.indicator}\n\n${formatted}`, 'เกณฑ์รูบริก');
                        }}
                        type="button"
                      >
                        <Copy size={13} /> คัดลอก
                      </button>
                    </div>
                  </div>

                  {/* Rubric Table */}
                  <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 font-black text-slate-700">
                            <th className="p-3 w-40">ประเด็นการประเมิน</th>
                            <th className="p-3 bg-emerald-50 text-emerald-900">ระดับ 4 (ดีเยี่ยม)</th>
                            <th className="p-3 bg-teal-50 text-teal-900">ระดับ 3 (ดี)</th>
                            <th className="p-3 bg-blue-50 text-blue-900">ระดับ 2 (พอใช้)</th>
                            <th className="p-3 bg-rose-50 text-rose-900">ระดับ 1 (ปรับปรุง)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {rubricResult.criteria.map((crit, idx) => (
                            <tr className="align-top" key={idx}>
                              <td className="p-3 font-bold text-slate-900 bg-slate-50/50">
                                <p>{crit.dimension}</p>
                                {crit.weight ? (
                                  <span className="text-[10px] text-slate-500 font-normal">
                                    น้ำหนัก: {crit.weight}
                                  </span>
                                ) : null}
                              </td>
                              {crit.levels.map((lvl) => (
                                <td className="p-3 leading-relaxed text-slate-700" key={lvl.level}>
                                  {lvl.description}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {rubricResult.scoringGuidance ? (
                    <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-3.5 text-xs text-violet-900">
                      <span className="font-bold">💡 คำแนะนำการให้คะแนน: </span>
                      <span>{rubricResult.scoringGuidance}</span>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Remedial Quiz Generator */}
          {activeTab === 'quiz' && (
            <div className="space-y-4">
              {/* Focus Topics */}
              <label className="grid gap-1.5 text-xs font-black text-slate-800">
                <div className="flex items-center justify-between">
                  <span>หัวข้อหรือเนื้อหาที่นักเรียนทำผิดบ่อย (ซ่อมเสริมเฉพาะจุด)</span>
                  <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-black text-rose-700 border border-rose-200">จำเป็น *</span>
                </div>
                <input
                  className={`h-10 rounded-xl border-2 px-3 font-bold text-slate-900 shadow-xs transition focus:outline-none ${
                    !focusTopics.trim()
                      ? 'border-rose-300 bg-rose-50/30 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                      : 'border-slate-300 bg-white focus:border-violet-500 focus:ring-2 focus:ring-violet-200'
                  }`}
                  onChange={(e) => setFocusTopics(e.target.value)}
                  placeholder="เช่น การบวกเศษส่วนที่ตัวส่วนไม่เท่ากัน"
                  value={focusTopics}
                />
              </label>

              {/* Configurable Question Count & Choice Type */}
              <div className="grid gap-3 sm:grid-cols-2">
                {/* 1. Custom Question Count */}
                <div className="rounded-2xl border-2 border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800">จำนวนข้อที่ต้องการ</span>
                    <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-black text-rose-700 border border-rose-200">จำเป็น *</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={questionCount}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (isNaN(val)) setQuestionCount(1);
                          else setQuestionCount(Math.min(30, Math.max(1, val)));
                        }}
                        className="h-10 w-24 rounded-xl border-2 border-slate-300 bg-white px-3 text-center text-sm font-black text-slate-900 shadow-xs focus:border-violet-500 focus:ring-2 focus:ring-violet-200 focus:outline-none"
                      />
                    </div>
                    <span className="text-xs font-bold text-slate-600">ข้อ</span>
                    <div className="flex items-center gap-1 ml-auto flex-wrap">
                      {[3, 5, 10, 15, 20].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setQuestionCount(num)}
                          className={`h-8 rounded-lg px-2.5 text-xs font-black transition ${
                            questionCount === num
                              ? 'bg-violet-600 text-white shadow-xs ring-2 ring-violet-300'
                              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[11px] font-medium text-slate-500">
                    💡 พิมพ์ตัวเลขได้อิสระ (1 - 30 ข้อ) หรือคลิกเลือกปุ่มลัด
                  </p>
                </div>

                {/* 2. Configurable Choice Type */}
                <div className="rounded-2xl border-2 border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800">รูปแบบตัวเลือก</span>
                    <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-black text-rose-700 border border-rose-200">จำเป็น *</span>
                  </div>
                  <select
                    value={choiceType}
                    onChange={(e) => setChoiceType(e.target.value as QuizChoiceType)}
                    className="h-10 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-xs font-black text-slate-900 shadow-xs focus:border-violet-500 focus:ring-2 focus:ring-violet-200 focus:outline-none cursor-pointer"
                  >
                    <option value="4-choices">4 ตัวเลือก (ก, ข, ค, ง - มาตรฐาน สพฐ.)</option>
                    <option value="3-choices">3 ตัวเลือก (ก, ข, ค - ประถมต้น ป.1-ป.3)</option>
                    <option value="5-choices">5 ตัวเลือก (ก, ข, ค, ง, จ - มัธยม/แข่งขัน)</option>
                    <option value="true-false">ถูก / ผิด (2 ตัวเลือก - ตรวจสอบมโนทัศน์)</option>
                  </select>
                  <p className="text-[11px] font-medium text-slate-500">
                    {choiceType === '4-choices' && '📌 4 ตัวเลือก ก-ง ตามรูปแบบข้อสอบมาตรฐาน'}
                    {choiceType === '3-choices' && '📌 3 ตัวเลือก ก-ค เหมาะกับเด็กเล็กหรือนักเรียนกลุ่มพิเศษ'}
                    {choiceType === '5-choices' && '📌 5 ตัวเลือก ก-จ เพิ่มความลึกของตัวลวงระดับมัธยม'}
                    {choiceType === 'true-false' && '📌 2 ตัวเลือก ถูก/ผิด เน้นดักจุดที่มักสับสน'}
                  </p>
                </div>
              </div>

              {!quizResult ? (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-violet-300 bg-violet-50/30 p-8 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                    <GraduationCap size={24} />
                  </div>
                  <p className="text-sm font-black text-slate-900">
                    คลิกปุ่มด้านล่างเพื่อสร้างชุดข้อสอบซ่อมเสริมพร้อมเฉลยละเอียด
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    AI จะสร้างข้อสอบ {choiceType === '4-choices' ? '4 ตัวเลือก (ก, ข, ค, ง)' : choiceType === '3-choices' ? '3 ตัวเลือก (ก, ข, ค)' : choiceType === '5-choices' ? '5 ตัวเลือก (ก, ข, ค, ง, จ)' : 'ถูก / ผิด'} จำนวน {questionCount} ข้อ พร้อมเฉลยละเอียดและวิเคราะห์จุดลวง
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-base font-black text-slate-900">{quizResult.title}</h4>
                      <p className="text-xs text-slate-500">
                        {quizResult.subject} • {quizResult.indicator}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50"
                        onClick={() => {
                          const formatted = quizResult.questions
                            .map((q) => `${q.questionNumber}. ${q.questionText}\n` + q.choices.map((c) => `   ${c.key}. ${c.text}`).join('\n') + `\n   เฉลย: ${q.correctAnswer} (${q.explanation})`)
                            .join('\n\n');
                          handleCopyText(`${quizResult.title}\n${quizResult.instructions}\n\n${formatted}`, 'ข้อสอบซ่อมเสริม');
                        }}
                        type="button"
                      >
                        <Copy size={13} /> คัดลอกทั้งหมด
                      </button>
                    </div>
                  </div>

                  {/* Questions List */}
                  <div className="space-y-3">
                    {quizResult.questions.map((q) => (
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs" key={q.questionNumber}>
                        <p className="text-sm font-black text-slate-900">
                          {q.questionNumber}. {q.questionText}
                        </p>
                        <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {q.choices.map((c) => {
                            const isCorrect = c.key === q.correctAnswer;
                            return (
                              <div
                                className={`flex items-center gap-2 rounded-xl p-2 text-xs font-bold transition ${
                                  isCorrect
                                    ? 'border border-emerald-300 bg-emerald-50 text-emerald-950 font-black'
                                    : 'border border-slate-200 bg-slate-50/60 text-slate-700'
                                }`}
                                key={c.key}
                              >
                                <span
                                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-black ${
                                    isCorrect
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-white text-slate-600 ring-1 ring-slate-200'
                                  }`}
                                >
                                  {c.key}
                                </span>
                                <span>{c.text}</span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-3 rounded-xl bg-slate-50 p-2.5 text-xs text-slate-600">
                          <span className="font-black text-emerald-700">เฉลย: ข้อ {q.correctAnswer}</span>
                          <span className="mx-1.5">•</span>
                          <span>{q.explanation}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Semester Exam Generator (Midterm / Final) */}
          {activeTab === 'exam' && (
            <div className="space-y-4">
              {/* Exam Configuration Grid */}
              <div className="grid gap-3 sm:grid-cols-3 rounded-2xl border-2 border-slate-200 bg-slate-50/70 p-4">
                {/* Exam Type */}
                <div className="grid gap-1.5 text-xs font-black text-slate-800">
                  <div className="flex items-center justify-between">
                    <span>ประเภทการสอบ</span>
                    <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-black text-rose-700 border border-rose-200">
                      จำเป็น *
                    </span>
                  </div>
                  <div className="flex rounded-xl bg-slate-200/80 p-1">
                    <button
                      type="button"
                      onClick={() => setExamType('midterm')}
                      className={`flex-1 rounded-lg py-1.5 text-center text-xs font-black transition ${
                        examType === 'midterm'
                          ? 'bg-violet-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      ข้อสอบกลางภาค
                    </button>
                    <button
                      type="button"
                      onClick={() => setExamType('final')}
                      className={`flex-1 rounded-lg py-1.5 text-center text-xs font-black transition ${
                        examType === 'final'
                          ? 'bg-violet-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      ข้อสอบปลายภาค
                    </button>
                  </div>
                </div>

                {/* Semester & Year */}
                <div className="grid grid-cols-2 gap-2 text-xs font-black text-slate-800">
                  <label className="grid gap-1.5">
                    <span>ภาคเรียน</span>
                    <select
                      value={semester}
                      onChange={(e) => setSemester(e.target.value)}
                      className="h-10 rounded-xl border-2 border-slate-300 bg-white px-2.5 font-bold text-slate-900 focus:border-violet-500 focus:outline-none"
                    >
                      <option value="1">ภาคเรียนที่ 1</option>
                      <option value="2">ภาคเรียนที่ 2</option>
                    </select>
                  </label>
                  <label className="grid gap-1.5">
                    <span>ปีการศึกษา</span>
                    <input
                      type="text"
                      value={academicYear}
                      onChange={(e) => setAcademicYear(e.target.value)}
                      placeholder="2568"
                      className="h-10 rounded-xl border-2 border-slate-300 bg-white px-2.5 font-bold text-slate-900 focus:border-violet-500 focus:outline-none text-center"
                    />
                  </label>
                </div>

                {/* Duration & Score */}
                <div className="grid grid-cols-2 gap-2 text-xs font-black text-slate-800">
                  <label className="grid gap-1.5">
                    <span>เวลาสอบ (นาที)</span>
                    <input
                      type="number"
                      min={15}
                      max={180}
                      step={5}
                      value={durationMinutes}
                      onChange={(e) =>
                        setDurationMinutes(Math.max(15, parseInt(e.target.value, 10) || 60))
                      }
                      className="h-10 rounded-xl border-2 border-slate-300 bg-white px-2.5 font-bold text-slate-900 focus:border-violet-500 focus:outline-none text-center"
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span>คะแนนเต็ม</span>
                    <input
                      type="number"
                      min={5}
                      max={100}
                      value={totalScore}
                      onChange={(e) =>
                        setTotalScore(Math.max(5, parseInt(e.target.value, 10) || 20))
                      }
                      className="h-10 rounded-xl border-2 border-slate-300 bg-white px-2.5 font-bold text-slate-900 focus:border-violet-500 focus:outline-none text-center"
                    />
                  </label>
                </div>
              </div>

              {/* Section 1: Multi-Unit Management (หน่วยการเรียนรู้ที่ออกสอบ - ใส่ได้หลายหน่วย) */}
              <div className="rounded-2xl border-2 border-slate-200 bg-slate-50/80 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-[10px] font-black text-white">
                      1
                    </span>
                    <span className="text-xs font-black text-slate-900">
                      หน่วยการเรียนรู้ที่ออกสอบ (ตัวหลัก - ใส่ได้หลายหน่วย)
                    </span>
                    <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-black text-rose-700 border border-rose-200">
                      จำเป็น *
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-slate-500">
                    ใส่หลายหน่วยเพื่อรวมเป็นข้อสอบชุดเดียว
                  </span>
                </div>

                {/* List of current units */}
                <div className="space-y-2">
                  {examUnits.map((u, idx) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs transition hover:border-violet-300"
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <span className="shrink-0 rounded-lg bg-violet-100 px-2 py-1 text-[11px] font-black text-violet-800 border border-violet-200">
                          หน่วยที่ {idx + 1}
                        </span>
                        <span className="text-xs font-bold text-slate-800 truncate">
                          {u.name}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveUnit(u.id)}
                        disabled={examUnits.length <= 1}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                        title={examUnits.length <= 1 ? 'ต้องมีอย่างน้อย 1 หน่วย' : 'ลบหน่วยนี้'}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add Unit input row */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newUnitInput}
                    onChange={(e) => setNewUnitInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddUnit();
                      }
                    }}
                    placeholder="พิมพ์ชื่อหน่วยการเรียนรู้เพิ่มเติม เช่น หน่วยที่ 3 สถิติและความน่าจะเป็น แล้วกดเพิ่ม"
                    className="h-9 flex-1 rounded-xl border-2 border-slate-300 bg-white px-3 text-xs font-medium text-slate-900 shadow-xs focus:border-violet-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddUnit}
                    disabled={!newUnitInput.trim()}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 text-xs font-black text-white shadow-xs hover:bg-violet-700 disabled:opacity-40 transition shrink-0"
                  >
                    <Plus size={14} /> เพิ่มหน่วย
                  </button>
                </div>
              </div>

              {/* Section 2: OBEC Indicators & Quota Allocation (วิเคราะห์จากหน่วย & ปรับสัดส่วนจำนวนข้อ) */}
              <div className="rounded-2xl border-2 border-slate-200 bg-slate-50/80 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-1 border-b border-slate-200/80">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-[10px] font-black text-white">
                      2
                    </span>
                    <div>
                      <span className="text-xs font-black text-slate-900">
                        ตัวชี้วัด สพฐ. & การกระจายจำนวนข้อสอบ
                      </span>
                      <p className="text-[11px] text-slate-500 font-medium">
                        ระบบวิเคราะห์ตัวชี้วัดจากหน่วยอัตโนมัติ คุณครูสามารถเพิ่มเติมหรือกำหนดจำนวนข้อได้
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleAnalyzeIndicators}
                      disabled={isAnalyzingIndicators || examUnits.length === 0}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3.5 py-1.5 text-xs font-black text-white shadow-xs hover:from-violet-700 hover:to-indigo-700 transition disabled:opacity-50"
                    >
                      {isAnalyzingIndicators ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          <span>กำลังวิเคราะห์...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={13} />
                          <span>✨ ให้ AI วิเคราะห์ตัวชี้วัดจากหน่วย</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingIndicatorManual(!isAddingIndicatorManual)}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-100 transition"
                    >
                      <Plus size={13} /> เพิ่มตัวชี้วัดเอง
                    </button>
                  </div>
                </div>

                {/* Inline Manual Add Form */}
                {isAddingIndicatorManual && (
                  <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3 space-y-2.5 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-violet-950">
                        ➕ เพิ่มตัวชี้วัดด้วยตนเอง
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsAddingIndicatorManual(false)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <input
                        type="text"
                        value={manualIndCode}
                        onChange={(e) => setManualIndCode(e.target.value)}
                        placeholder="รหัสตัวชี้วัด เช่น ค 1.1 ป.5/4"
                        className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-violet-500"
                      />
                      <input
                        type="text"
                        value={manualIndName}
                        onChange={(e) => setManualIndName(e.target.value)}
                        placeholder="คำอธิบายตัวชี้วัด (ระบุสั้นๆ)"
                        className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 focus:outline-none focus:border-violet-500"
                      />
                      <select
                        value={manualIndUnit}
                        onChange={(e) => setManualIndUnit(e.target.value)}
                        className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-violet-500"
                      >
                        <option value="">เลือกหน่วยที่สังกัด (ถ้ามี)</option>
                        {examUnits.map((u) => (
                          <option key={u.id} value={u.name}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsAddingIndicatorManual(false)}
                        className="rounded-lg px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-200"
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="button"
                        onClick={handleAddManualIndicator}
                        disabled={!manualIndCode.trim()}
                        className="rounded-lg bg-violet-600 px-3.5 py-1 text-xs font-black text-white hover:bg-violet-700 disabled:opacity-40"
                      >
                        บันทึกตัวชี้วัด
                      </button>
                    </div>
                  </div>
                )}

                {/* Allocation Mode & Quota Status Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl bg-white p-3 border border-slate-200 shadow-xs">
                  {/* Mode Selector */}
                  <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIndicatorMode('balanced');
                        setExamIndicators((prev) =>
                          rebalanceIndicators(prev, totalExamQuestions)
                        );
                      }}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black transition ${
                        indicatorMode === 'balanced'
                          ? 'bg-violet-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Sliders size={13} />
                      <span>สมดุลอัตโนมัติ (เฉลี่ยเท่าๆ กัน)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIndicatorMode('custom')}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black transition ${
                        indicatorMode === 'custom'
                          ? 'bg-violet-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>กำหนดจำนวนข้อเอง</span>
                    </button>
                  </div>

                  {/* Status Indicator */}
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <div className="flex items-center gap-1.5 font-black text-slate-700">
                      <span>จัดสรร:</span>
                      <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-slate-900 font-mono">
                        {totalAllocatedQuestions} / {totalExamQuestions} ข้อ
                      </span>
                    </div>

                    {totalAllocatedQuestions === totalExamQuestions ? (
                      <span className="flex items-center gap-1 rounded-lg bg-emerald-100 px-2 py-0.5 text-[11px] font-black text-emerald-800 border border-emerald-200">
                        <Check size={13} /> สมดุลครบถ้วน
                      </span>
                    ) : totalAllocatedQuestions < totalExamQuestions ? (
                      <div className="flex items-center gap-1">
                        <span className="flex items-center gap-1 rounded-lg bg-amber-100 px-2 py-0.5 text-[11px] font-black text-amber-800 border border-amber-200">
                          ขาดอีก {totalExamQuestions - totalAllocatedQuestions} ข้อ
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setExamIndicators((prev) =>
                              rebalanceIndicators(prev, totalExamQuestions)
                            )
                          }
                          className="inline-flex items-center gap-1 text-[11px] font-black text-violet-700 underline hover:text-violet-900"
                        >
                          <RefreshCw size={11} /> ปรับเฉลี่ย
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="flex items-center gap-1 rounded-lg bg-rose-100 px-2 py-0.5 text-[11px] font-black text-rose-800 border border-rose-200">
                          เกินมา {totalAllocatedQuestions - totalExamQuestions} ข้อ
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setExamIndicators((prev) =>
                              rebalanceIndicators(prev, totalExamQuestions)
                            )
                          }
                          className="inline-flex items-center gap-1 text-[11px] font-black text-violet-700 underline hover:text-violet-900"
                        >
                          <RefreshCw size={11} /> ปรับเฉลี่ย
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Indicators List */}
                {examIndicators.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
                    <p className="text-xs font-bold text-slate-700">
                      ยังไม่มีตัวชี้วัดในรายการ
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      คลิกปุ่ม "✨ ให้ AI วิเคราะห์ตัวชี้วัดจากหน่วย" หรือ "+ เพิ่มตัวชี้วัดเอง" เพื่อเริ่มต้น
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {examIndicators.map((ind) => (
                      <div
                        key={ind.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-xs hover:border-violet-300 transition"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="rounded-md bg-violet-100 px-2 py-0.5 text-xs font-black text-violet-800 border border-violet-200">
                              {ind.code}
                            </span>
                            {ind.unitName && (
                              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 truncate max-w-[200px]">
                                {ind.unitName}
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-medium text-slate-800 line-clamp-1">
                            {ind.name}
                          </p>
                        </div>

                        {/* Count & Actions */}
                        <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                          {indicatorMode === 'custom' ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-bold text-slate-500">
                                กำหนด:
                              </span>
                              <div className="flex items-center rounded-lg border border-slate-300 bg-white shadow-xs">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateIndicatorCount(
                                      ind.id,
                                      Math.max(1, (ind.count || 1) - 1)
                                    )
                                  }
                                  className="h-7 w-7 flex items-center justify-center text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-l-lg"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min={1}
                                  max={30}
                                  value={ind.count}
                                  onChange={(e) =>
                                    handleUpdateIndicatorCount(
                                      ind.id,
                                      parseInt(e.target.value, 10) || 1
                                    )
                                  }
                                  className="h-7 w-12 text-center text-xs font-black text-slate-900 border-x border-slate-200 focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateIndicatorCount(
                                      ind.id,
                                      (ind.count || 1) + 1
                                    )
                                  }
                                  className="h-7 w-7 flex items-center justify-center text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-r-lg"
                                >
                                  +
                                </button>
                              </div>
                              <span className="text-xs font-bold text-slate-700">
                                ข้อ
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="rounded-lg bg-violet-50 border border-violet-200 px-2.5 py-1 text-xs font-black text-violet-800 font-mono">
                                {ind.count} ข้อ
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
                                (เฉลี่ยอัตโนมัติ)
                              </span>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => handleRemoveIndicator(ind.id)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                            title="ลบตัวชี้วัดนี้"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Mandatory Indicator Tag Notice */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/80">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showIndicatorInStudentPaper}
                      onChange={(e) => setShowIndicatorInStudentPaper(e.target.checked)}
                      className="h-4 w-4 rounded text-violet-600 focus:ring-violet-400"
                    />
                    <span>
                      แสดงรหัสตัวชี้วัดกำกับท้ายข้อคำถามในกระดาษข้อสอบนักเรียน (เช่น ... [ตัวชี้วัด {examIndicators[0]?.code || 'ค 1.1 ป.5/1'}])
                    </span>
                  </label>
                  <span className="text-[11px] font-bold text-violet-700 hidden sm:inline">
                    * ในผัง Blueprint & ฉบับครูจะแสดงกำกับทุกข้ออยู่แล้ว
                  </span>
                </div>
              </div>

              {/* Question Structure & Difficulty */}
              <div className="grid gap-3 sm:grid-cols-3 rounded-2xl border-2 border-slate-200 bg-slate-50/70 p-4">
                {/* Part 1 Setup */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800">ตอนที่ 1 ปรนัย (กากบาท)</span>
                    <span className="text-[10px] font-bold text-violet-700">ข้อสอบเลือกตอบ</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={5}
                        max={50}
                        value={examPart1Count}
                        onChange={(e) =>
                          setExamPart1Count(
                            Math.min(50, Math.max(5, parseInt(e.target.value, 10) || 10))
                          )
                        }
                        className="h-9 w-16 rounded-xl border-2 border-slate-300 bg-white text-center text-xs font-black text-slate-900 focus:border-violet-500 focus:outline-none"
                      />
                      <span className="text-xs font-bold text-slate-600">ข้อ</span>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {[10, 15, 20, 30].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setExamPart1Count(n)}
                          className={`h-7 rounded-lg px-2 text-[11px] font-black ${
                            examPart1Count === n
                              ? 'bg-violet-600 text-white'
                              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <select
                    value={examPart1ChoiceType}
                    onChange={(e) =>
                      setExamPart1ChoiceType(e.target.value as '4-choices' | '5-choices')
                    }
                    className="h-8 w-full rounded-xl border-2 border-slate-300 bg-white px-2 text-xs font-bold text-slate-800 focus:border-violet-500 focus:outline-none"
                  >
                    <option value="4-choices">4 ตัวเลือก (ก, ข, ค, ง - มาตรฐาน สพฐ.)</option>
                    <option value="5-choices">5 ตัวเลือก (ก, ข, ค, ง, จ - มัธยม/แข่งขัน)</option>
                  </select>
                </div>

                {/* Part 2 Setup */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800">ตอนที่ 2 อัตนัย (เขียนตอบ)</span>
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-violet-800">
                      <input
                        type="checkbox"
                        checked={examIncludePart2}
                        onChange={(e) => setExamIncludePart2(e.target.checked)}
                        className="h-4 w-4 rounded text-violet-600 focus:ring-violet-400"
                      />
                      <span>มีตอนที่ 2</span>
                    </label>
                  </div>
                  {examIncludePart2 ? (
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={examPart2Count}
                        onChange={(e) =>
                          setExamPart2Count(
                            Math.min(5, Math.max(1, parseInt(e.target.value, 10) || 1))
                          )
                        }
                        className="h-9 w-16 rounded-xl border-2 border-slate-300 bg-white text-center text-xs font-black text-slate-900 focus:border-violet-500 focus:outline-none"
                      />
                      <span className="text-xs font-bold text-slate-600">ข้อ</span>
                      <div className="flex gap-1 ml-auto">
                        {[1, 2, 3].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setExamPart2Count(n)}
                            className={`h-7 rounded-lg px-2 text-[11px] font-black ${
                              examPart2Count === n
                                ? 'bg-violet-600 text-white'
                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {n} ข้อ
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 pt-2 italic">ไม่มีข้อสอบตอนที่ 2 (ปรนัยล้วน)</p>
                  )}
                </div>

                {/* Bloom Distribution */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800">ระดับพฤติกรรม (Bloom)</span>
                  </div>
                  <select
                    value={examDifficulty}
                    onChange={(e) =>
                      setExamDifficulty(
                        e.target.value as 'balanced' | 'basic' | 'advanced'
                      )
                    }
                    className="h-9 w-full rounded-xl border-2 border-slate-300 bg-white px-2 text-xs font-bold text-slate-800 focus:border-violet-500 focus:outline-none"
                  >
                    <option value="balanced">สมดุล สพฐ. (จำ 30% : เข้าใจ 50% : วิเคราะห์ 20%)</option>
                    <option value="basic">เน้นมโนทัศน์พื้นฐาน (จำ 50% : เข้าใจ 40% : ประยุกต์ 10%)</option>
                    <option value="advanced">คิดวิเคราะห์ขั้นสูง (เข้าใจ 30% : ประยุกต์ 40% : วิเคราะห์ 30%)</option>
                  </select>
                  <p className="text-[11px] font-medium text-slate-500">
                    💡 สอดคล้องตามมาตรฐานผังการสร้างข้อสอบของ สพฐ.
                  </p>
                </div>
              </div>

              {/* Result Container */}
              {!examResult ? (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-violet-300 bg-violet-50/30 p-8 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                    <BookOpen size={24} />
                  </div>
                  <p className="text-sm font-black text-slate-900">
                    คลิกปุ่มด้านล่างเพื่อสร้างชุดข้อสอบ{examType === 'midterm' ? 'กลางภาค' : 'ปลายภาค'}พร้อมหัวกระดาษและผังวิเคราะห์
                  </p>
                  <p className="mt-1 text-xs text-slate-500 max-w-lg">
                    ระบบจะสร้างหัวกระดาษข้อสอบ สพฐ. กล่องข้อมูลนักเรียน ตอนที่ 1 ({examPart1Count} ข้อ) {examIncludePart2 ? `ตอนที่ 2 (${examPart2Count} ข้อ)` : ''} พร้อมเฉลยละเอียดสำหรับครู และตาราง Test Blueprint ส่งฝ่ายวิชาการ
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Actions Bar & Sub-Tabs */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    {/* Sub Tabs */}
                    <div className="flex rounded-xl bg-white p-1 ring-1 ring-slate-200 shadow-xs">
                      <button
                        type="button"
                        onClick={() => setExamViewSubTab('paper')}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black transition ${
                          examViewSubTab === 'paper'
                            ? 'bg-violet-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <FileText size={14} />
                        <span>1. กระดาษข้อสอบ (นักเรียน)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setExamViewSubTab('key')}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black transition ${
                          examViewSubTab === 'key'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <CheckCircle2 size={14} />
                        <span>2. เฉลยละเอียด (ครู)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setExamViewSubTab('blueprint')}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black transition ${
                          examViewSubTab === 'blueprint'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Table size={14} />
                        <span>3. ผัง Test Blueprint</span>
                      </button>
                    </div>

                    {/* Quick Print & Copy Buttons */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => printExamDocument(examResult, 'student')}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-black text-violet-800 shadow-xs hover:bg-violet-100 transition"
                        title="พิมพ์ตัวกระดาษข้อสอบสำหรับแจกให้นักเรียนทำ (ไม่มีเฉลย)"
                      >
                        <Printer size={13} /> พิมพ์ชุดนักเรียน
                      </button>
                      <button
                        type="button"
                        onClick={() => printExamDocument(examResult, 'teacher')}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-800 shadow-xs hover:bg-slate-100 transition"
                        title="พิมพ์เฉลยละเอียดและตาราง Test Blueprint สำหรับครูและฝ่ายวิชาการ"
                      >
                        <Printer size={13} /> พิมพ์ชุดครู/Blueprint
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          let fullText = `${examResult.examTitle}\n`;
                          fullText += `วิชา: ${examResult.subject} ชั้น: ${examResult.gradeLevel} ภาคเรียนที่ ${examResult.term} ปีการศึกษา ${examResult.academicYear}\n`;
                          fullText += `เวลา: ${examResult.timeMinutes} นาที คะแนนเต็ม: ${examResult.totalScore} คะแนน\n\n`;
                          fullText += `คำชี้แจง: ${examResult.instructions}\n\n`;
                          fullText += `--- ${examResult.part1.title} ---\n`;
                          examResult.part1.questions.forEach((q) => {
                            fullText += `${q.questionNumber}. ${q.questionText}\n`;
                            q.choices.forEach((c) => {
                              fullText += `   ${c.key}. ${c.text}\n`;
                            });
                          });
                          if (examResult.part2 && examResult.part2.questions && examResult.part2.questions.length > 0) {
                            fullText += `\n--- ${examResult.part2.title} ---\n`;
                            examResult.part2.questions.forEach((q) => {
                              fullText += `ข้อที่ ${q.questionNumber}. ${q.questionText} (${q.maxScore} คะแนน)\n\n`;
                            });
                          }
                          handleCopyText(fullText, 'เนื้อหาข้อสอบสำหรับ Word');
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition"
                      >
                        <Copy size={13} /> คัดลอก
                      </button>
                    </div>
                  </div>

                  {/* View 1: Student Paper */}
                  {examViewSubTab === 'paper' && (
                    <div className="rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm space-y-5">
                      {/* School Header */}
                      <div className="text-center border-b-2 border-slate-800 pb-4 space-y-1">
                        <h4 className="text-base font-black text-slate-900">{examResult.examTitle}</h4>
                        <p className="text-xs font-bold text-slate-700">
                          กลุ่มสาระการเรียนรู้{examResult.subject} ชั้น{examResult.gradeLevel} ภาคเรียนที่ {examResult.term} ปีการศึกษา {examResult.academicYear}
                        </p>
                        <p className="text-xs font-semibold text-slate-600">
                          เวลาสอบ {examResult.timeMinutes} นาที • คะแนนเต็ม {examResult.totalScore} คะแนน
                        </p>
                      </div>

                      {/* Student Info Box */}
                      <div className="rounded-xl border border-slate-400 p-3 bg-slate-50/50 flex flex-wrap justify-between gap-2 text-xs font-bold text-slate-800">
                        <div>ชื่อ-นามสกุล: ............................................................................</div>
                        <div>ชั้น: ............ เลขที่: ........ ห้อง: ........</div>
                      </div>

                      {/* General Instructions */}
                      <div className="rounded-xl bg-amber-50/80 border border-amber-200 p-3 text-xs text-amber-900">
                        <span className="font-black">📌 คำชี้แจงทั่วไป: </span>
                        <span>{examResult.instructions}</span>
                      </div>

                      {/* Part 1 */}
                      <div className="space-y-3">
                        <div className="rounded-lg bg-slate-100 p-2 text-xs font-black text-slate-800 border-l-4 border-violet-600">
                          {examResult.part1.title} ({examResult.part1.itemCount} ข้อ • รวม {examResult.part1.totalScore} คะแนน)
                        </div>
                        <div className="space-y-3">
                          {examResult.part1.questions.map((q) => (
                            <div key={q.questionNumber} className="rounded-2xl border border-slate-200 bg-slate-50/30 p-3.5 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-xs font-black text-slate-900">
                                  {q.questionNumber}. {q.questionText}
                                </p>
                                {q.indicator && (
                                  <span className="shrink-0 rounded-md bg-violet-100 px-2 py-0.5 text-[10px] font-black text-violet-800 border border-violet-200" title="ตัวชี้วัด สพฐ. ประจำข้อ">
                                    ตัวชี้วัด {q.indicator}
                                  </span>
                                )}
                              </div>
                              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                {q.choices.map((c) => (
                                  <div key={c.key} className="flex items-center gap-2 rounded-lg bg-white p-2 border border-slate-200">
                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] font-black text-slate-700">
                                      {c.key}
                                    </span>
                                    <span className="text-slate-800 font-medium">{c.text}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Part 2 Subjective */}
                      {examResult.part2 && examResult.part2.questions && examResult.part2.questions.length > 0 && (
                        <div className="space-y-3 pt-2">
                          <div className="rounded-lg bg-slate-100 p-2 text-xs font-black text-slate-800 border-l-4 border-emerald-600">
                            {examResult.part2.title} ({examResult.part2.itemCount} ข้อ • รวม {examResult.part2.totalScore} คะแนน)
                          </div>
                          <div className="space-y-4">
                            {examResult.part2.questions.map((q) => (
                              <div key={q.questionNumber} className="rounded-2xl border border-slate-200 bg-slate-50/30 p-3.5 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <span className="text-xs font-black text-slate-900">
                                    ข้อที่ {q.questionNumber}. {q.questionText}
                                  </span>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {q.indicator && (
                                      <span className="rounded-md bg-violet-100 px-2 py-0.5 text-[10px] font-black text-violet-800 border border-violet-200" title="ตัวชี้วัด สพฐ. ประจำข้อ">
                                        ตัวชี้วัด {q.indicator}
                                      </span>
                                    )}
                                    <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                                      {q.maxScore} คะแนน
                                    </span>
                                  </div>
                                </div>
                                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-400">
                                  (พื้นที่แสดงวิธีทำ / คำตอบของนักเรียน)
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* View 2: Teacher Answer Key */}
                  {examViewSubTab === 'key' && (
                    <div className="rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm space-y-5">
                      <div className="flex items-center justify-between border-b pb-3">
                        <div>
                          <h4 className="text-base font-black text-slate-900">🔑 เฉลยละเอียดและเกณฑ์ตรวจ (สำหรับครู)</h4>
                          <p className="text-xs font-bold text-slate-500">วิชา{examResult.subject} ชั้น{examResult.gradeLevel} ภาคเรียนที่ {examResult.term}</p>
                        </div>
                        <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-black text-rose-800 border border-rose-200">
                          เอกสารลับเฉพาะครูผู้สอน
                        </span>
                      </div>

                      {/* Part 1 Answers Table */}
                      <div className="space-y-2">
                        <h5 className="text-xs font-black text-slate-800">ตอนที่ 1 เฉลยข้อสอบปรนัย</h5>
                        <div className="rounded-2xl border border-slate-200 overflow-hidden">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-100 text-slate-800 font-black">
                              <tr>
                                <th className="p-2.5 text-center w-12">ข้อ</th>
                                <th className="p-2.5 text-center w-16">เฉลย</th>
                                <th className="p-2.5 w-28">ตัวชี้วัด</th>
                                <th className="p-2.5 w-28">ระดับ Bloom</th>
                                <th className="p-2.5">คำอธิบายเหตุผลและวิเคราะห์ตัวลวง</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {examResult.part1.questions.map((q) => (
                                <tr key={q.questionNumber} className="hover:bg-slate-50/60">
                                  <td className="p-2.5 text-center font-black text-slate-700">{q.questionNumber}</td>
                                  <td className="p-2.5 text-center">
                                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-600 font-black text-white text-xs">
                                      {q.correctAnswer}
                                    </span>
                                  </td>
                                  <td className="p-2.5 font-bold text-slate-600">{q.indicator || '-'}</td>
                                  <td className="p-2.5 text-slate-600">{q.bloomLevel || '-'}</td>
                                  <td className="p-2.5 text-slate-700">{q.explanation}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Part 2 Rubrics */}
                      {examResult.part2 && examResult.part2.questions && examResult.part2.questions.length > 0 && (
                        <div className="space-y-3 pt-3 border-t">
                          <h5 className="text-xs font-black text-slate-800">ตอนที่ 2 แนวคำตอบและเกณฑ์การให้คะแนนอัตนัย</h5>
                          <div className="space-y-3">
                            {examResult.part2.questions.map((q) => (
                              <div key={q.questionNumber} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black text-slate-900">
                                    ข้อที่ {q.questionNumber}. {q.questionText}
                                  </span>
                                  <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                                    คะแนนเต็ม {q.maxScore} คะแนน
                                  </span>
                                </div>
                                <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-3 text-xs text-emerald-950">
                                  <span className="font-black">แนวคำตอบ / วิธีทำที่ถูกต้อง: </span>
                                  <span>{q.sampleAnswer}</span>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
                                  <span className="font-bold text-slate-800">เกณฑ์การให้คะแนน: </span>
                                  <span className="text-slate-700">{q.scoringCriteria}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* View 3: Test Blueprint */}
                  {examViewSubTab === 'blueprint' && (
                    <div className="rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b pb-3">
                        <div>
                          <h4 className="text-base font-black text-slate-900">📊 ตารางผังวิเคราะห์ข้อสอบ (Test Blueprint)</h4>
                          <p className="text-xs font-bold text-slate-500">เอกสารแนบตามเกณฑ์งานวัดและประเมินผลการศึกษา สพฐ.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const headers = 'สาระ/เนื้อหา\tตัวชี้วัด\tจำนวนข้อปรนัย\tจำนวนข้ออัตนัย\tคะแนนรวม\tการกระจาย Bloom\n';
                            const rows = examResult.blueprint
                              .map(
                                (b) =>
                                  `${b.unitName}\t${b.indicator}\t${b.multipleChoiceCount}\t${b.subjectiveCount}\t${b.totalScore}\t${b.bloomDistribution}`
                              )
                              .join('\n');
                            handleCopyText(headers + rows, 'ตาราง Test Blueprint สำหรับ Excel');
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-100"
                        >
                          <Copy size={13} /> คัดลอกตารางลง Excel
                        </button>
                      </div>

                      <div className="rounded-2xl border border-slate-200 overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100 text-slate-800 font-black">
                            <tr>
                              <th className="p-3">สาระ / หน่วยการเรียนรู้</th>
                              <th className="p-3">ตัวชี้วัด สพฐ.</th>
                              <th className="p-3 text-center w-24">ปรนัย</th>
                              <th className="p-3 text-center w-24">อัตนัย</th>
                              <th className="p-3 text-center w-24">คะแนนรวม</th>
                              <th className="p-3">การกระจายพฤติกรรม (Bloom)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {examResult.blueprint.map((bp, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/60">
                                <td className="p-3 font-bold text-slate-900">{bp.unitName}</td>
                                <td className="p-3 font-semibold text-slate-700">{bp.indicator}</td>
                                <td className="p-3 text-center font-black text-violet-700">{bp.multipleChoiceCount} ข้อ</td>
                                <td className="p-3 text-center font-black text-indigo-700">{bp.subjectiveCount} ข้อ</td>
                                <td className="p-3 text-center font-black text-emerald-700">{bp.totalScore}</td>
                                <td className="p-3 text-slate-600 font-medium">
                                  {bp.bloomDistribution}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-3.5 text-xs text-blue-900 flex items-start gap-2">
                        <Lightbulb size={16} className="shrink-0 text-blue-600 mt-0.5" />
                        <span>
                          ตาราง Test Blueprint นี้สามารถคัดลอกลง Excel หรือพิมพ์แนบส่งให้แก่ฝ่ายวิชาการของสถานศึกษา เพื่อตรวจสอบความตรงเชิงโครงสร้าง (Construct Validity) และความสอดคล้องตามมาตรฐานหลักสูตรแกนกลางฯ ได้ทันที
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button
            className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200"
            onClick={onClose}
            type="button"
          >
            ปิดหน้าต่าง
          </button>

          {activeTab === 'rubric' ? (
            <button
              className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-5 py-2.5 text-xs font-black text-white shadow-md hover:bg-violet-700 disabled:opacity-50"
              disabled={
                isGenerating ||
                hasApiKey === false ||
                !subject.trim() ||
                !gradeLevel.trim() ||
                !indicator.trim() ||
                !taskDescription.trim()
              }
              onClick={handleGenerateRubric}
              type="button"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span>กำลังออกแบบเกณฑ์ Rubrics...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>{rubricResult ? 'สร้างเกณฑ์ใหม่' : 'ออกแบบเกณฑ์ Rubrics 4 ระดับ'}</span>
                </>
              )}
            </button>
          ) : activeTab === 'quiz' ? (
            <button
              className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-5 py-2.5 text-xs font-black text-white shadow-md hover:bg-violet-700 disabled:opacity-50"
              disabled={
                isGenerating ||
                hasApiKey === false ||
                !subject.trim() ||
                !gradeLevel.trim() ||
                !indicator.trim() ||
                !focusTopics.trim() ||
                questionCount < 1
              }
              onClick={handleGenerateQuiz}
              type="button"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span>กำลังสร้างข้อสอบซ่อมเสริม...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>
                    {quizResult
                      ? 'สร้างข้อสอบชุดใหม่'
                      : `สร้างข้อสอบซ่อมเสริม ${questionCount} ข้อ (${
                          choiceType === '4-choices'
                            ? '4 ตัวเลือก'
                            : choiceType === '3-choices'
                            ? '3 ตัวเลือก'
                            : choiceType === '5-choices'
                            ? '5 ตัวเลือก'
                            : 'ถูก/ผิด'
                        })`}
                  </span>
                </>
              )}
            </button>
          ) : (
            <button
              className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-5 py-2.5 text-xs font-black text-white shadow-md hover:bg-violet-700 disabled:opacity-50"
              disabled={
                isGenerating ||
                hasApiKey === false ||
                !subject.trim() ||
                !gradeLevel.trim() ||
                examUnits.length === 0 ||
                examPart1Count < 5
              }
              onClick={handleGenerateExam}
              type="button"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span>กำลังออกข้อสอบ {examType === 'midterm' ? 'กลางภาค' : 'ปลายภาค'} & Blueprint...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>
                    {examResult
                      ? 'ออกข้อสอบชุดใหม่'
                      : `ออกข้อสอบ${examType === 'midterm' ? 'กลางภาค' : 'ปลายภาค'} (${examPart1Count} ข้อปรนัย${
                          examIncludePart2 ? ` + ${examPart2Count} ข้ออัตนัย` : ''
                        })`}
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
