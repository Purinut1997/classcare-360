import { useState, useEffect, useRef } from 'react';
import {
  Check,
  ChevronRight,
  Download,
  FileText,
  Printer,
  RotateCcw,
  Sparkles,
  Sliders,
  Play,
  Layers,
  FolderArchive,
  Upload,
  Plus,
  Trash2,
  QrCode,
  Copy,
  Shuffle,
  X,
  Search,
  CheckCircle2,
  Calendar,
  Layers3,
  User,
  Share2,
  Lock,
} from 'lucide-react';
import type { AnswerSheetConfig, ChoiceLabelType, StudentIdFormat, ExamBankTemplate } from '../../types/omr';
import { CHOICE_KEYS_ABCD, generateSyntheticFilledSheet, getChoiceLabel } from '../../lib/omrEngine';
import {
  getExamBankTemplates,
  saveExamBankTemplate,
  deleteExamBankTemplate,
  toggleShareExamBankTemplate,
  exportExamBankToJson,
  importExamBankFromJson,
} from '../../lib/omrExamBankStorage';
import { PrintableAnswerSheet } from './PrintableAnswerSheet';

interface AnswerSheetDesignerProps {
  config: AnswerSheetConfig;
  onChangeConfig: (newConfig: AnswerSheetConfig) => void;
  onStartScanning: () => void;
  workspaceName?: string;
  teacherId?: string;
  teacherName?: string;
  workspaceId?: string;
}

export function AnswerSheetDesigner({
  config,
  onChangeConfig,
  onStartScanning,
  workspaceName = 'โรงเรียนต้นแบบ ClassCare 360',
  teacherId,
  teacherName,
  workspaceId,
}: AnswerSheetDesignerProps) {
  const [activeSubTab, setActiveSubTab] = useState<'settings' | 'answer_key' | 'preview'>('settings');

  // Exam Bank & Modal State
  const [showExamBankModal, setShowExamBankModal] = useState(false);
  const [bankTemplates, setBankTemplates] = useState<ExamBankTemplate[]>([]);
  const [bankSearch, setBankSearch] = useState('');
  const [bankYearFilter, setBankYearFilter] = useState<string>('all');
  const [saveTitle, setSaveTitle] = useState(config.title || '');
  const [saveYear, setSaveYear] = useState(config.academicYear || '2568');
  const [saveTerm, setSaveTerm] = useState(config.term || '1');
  const [bankScope, setBankScope] = useState<'my_exams' | 'school_shared'>('my_exams');
  const [saveSharedToSchool, setSaveSharedToSchool] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const effectiveTeacherId = teacherId || config.teacherId || 'teacher_demo_01';
  const effectiveTeacherName = teacherName || config.teacherName || 'ครูผู้สอน';

  // Multi-Set Preview in Tab 3
  const [previewAllSets, setPreviewAllSets] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load templates on mount & open
  useEffect(() => {
    setBankTemplates(getExamBankTemplates());
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const updateConfig = (updates: Partial<AnswerSheetConfig>) => {
    const updated = { ...config, ...updates };

    // Ensure examSets contains current set's keys
    const currentSet = updated.examSet || '01';
    const currentExamSets = { ...(updated.examSets || {}) };
    if (!currentExamSets[currentSet] || updates.answerKeys) {
      currentExamSets[currentSet] = { ...(updated.answerKeys || config.answerKeys) };
    }
    updated.examSets = currentExamSets;

    // Recalculate total score
    let totalScore = 0;
    for (let q = 1; q <= updated.totalQuestions; q++) {
      totalScore += updated.pointsPerQuestion[q] ?? 1;
    }
    updated.totalScore = totalScore;
    onChangeConfig(updated);
  };

  // Current active set key & available sets list
  const currentSet = config.examSet || '01';
  const availableSets = Object.keys(config.examSets || { [currentSet]: config.answerKeys });
  if (!availableSets.includes(currentSet)) {
    availableSets.push(currentSet);
  }
  availableSets.sort();

  // Multi-set operations
  const handleSwitchSet = (targetSet: string) => {
    // 1. Sync current keys into current set map
    const nextExamSets = { ...(config.examSets || {}) };
    nextExamSets[currentSet] = { ...config.answerKeys };

    // 2. Fetch or create keys for target set
    let targetKeys = nextExamSets[targetSet];
    if (!targetKeys) {
      targetKeys = { ...config.answerKeys };
      nextExamSets[targetSet] = targetKeys;
    }

    updateConfig({
      examSet: targetSet,
      answerKeys: targetKeys,
      examSets: nextExamSets,
    });
  };

  const handleAddSet = () => {
    // Auto-generate next set code e.g. 01 -> 02 -> 03
    const nextNum = availableSets.length + 1;
    const nextSetCode = String(nextNum).padStart(2, '0');

    const nextExamSets = { ...(config.examSets || {}) };
    nextExamSets[currentSet] = { ...config.answerKeys };
    // Clone keys from set 01 or current set
    nextExamSets[nextSetCode] = { ...config.answerKeys };

    updateConfig({
      examSet: nextSetCode,
      answerKeys: { ...config.answerKeys },
      examSets: nextExamSets,
    });
    showToast(`เพิ่มชุดข้อสอบ "${nextSetCode}" เรียบร้อยแล้ว`);
  };

  const handleDeleteSet = (setToDelete: string) => {
    if (availableSets.length <= 1) {
      alert('ต้องมีชุดข้อสอบอย่างน้อย 1 ชุด');
      return;
    }
    if (!confirm(`คุณต้องการลบชุดข้อสอบ "${setToDelete}" หรือไม่?`)) return;

    const nextExamSets = { ...(config.examSets || {}) };
    delete nextExamSets[setToDelete];

    const remaining = Object.keys(nextExamSets);
    const fallbackSet = remaining[0] || '01';

    updateConfig({
      examSet: fallbackSet,
      answerKeys: nextExamSets[fallbackSet] || { ...config.answerKeys },
      examSets: nextExamSets,
    });
    showToast(`ลบชุดข้อสอบ "${setToDelete}" เรียบร้อย`);
  };

  const handleCopyFromBaseSet = (sourceSet: string = '01') => {
    const sourceKeys = config.examSets?.[sourceSet] || config.answerKeys;
    const nextExamSets = { ...(config.examSets || {}) };
    nextExamSets[currentSet] = { ...sourceKeys };

    updateConfig({
      answerKeys: { ...sourceKeys },
      examSets: nextExamSets,
    });
    showToast(`คัดลอกเฉลยจากชุด "${sourceSet}" มายังชุด "${currentSet}" แล้ว`);
  };

  const handleShuffleChoices = () => {
    // Scramble / permute choices for anti-cheating variant
    const choices = CHOICE_KEYS_ABCD.slice(0, config.choicesCount);
    const newKeys: Record<number, string> = {};

    for (let q = 1; q <= config.totalQuestions; q++) {
      const originalKey = config.answerKeys[q] || 'A';
      const origIdx = choices.indexOf(originalKey);
      // Shift choice index cyclically + 1
      const newIdx = origIdx >= 0 ? (origIdx + 1) % choices.length : 0;
      newKeys[q] = choices[newIdx];
    }

    const nextExamSets = { ...(config.examSets || {}) };
    nextExamSets[currentSet] = newKeys;

    updateConfig({
      answerKeys: newKeys,
      examSets: nextExamSets,
    });
    showToast(`สลับช้อยส์คำตอบสำหรับชุด "${currentSet}" เพื่อป้องกันการลอกข้อสอบแล้ว`);
  };

  const handleTotalQuestionsChange = (count: number) => {
    const currentKeys = { ...config.answerKeys };
    const currentPoints = { ...config.pointsPerQuestion };
    const choices = CHOICE_KEYS_ABCD.slice(0, config.choicesCount);

    for (let q = 1; q <= count; q++) {
      if (!currentKeys[q]) {
        currentKeys[q] = choices[(q - 1) % choices.length];
      }
      if (currentPoints[q] === undefined) {
        currentPoints[q] = 1;
      }
    }

    updateConfig({
      totalQuestions: count,
      answerKeys: currentKeys,
      pointsPerQuestion: currentPoints,
      layout: count <= 30 ? config.layout : 'single_full',
    });
  };

  const handleAnswerKeySelect = (questionNumber: number, choice: string) => {
    const nextKeys = {
      ...config.answerKeys,
      [questionNumber]: choice,
    };
    const nextExamSets = { ...(config.examSets || {}) };
    nextExamSets[currentSet] = nextKeys;

    updateConfig({
      answerKeys: nextKeys,
      examSets: nextExamSets,
    });
  };

  const handlePointWeightChange = (questionNumber: number, point: number) => {
    updateConfig({
      pointsPerQuestion: {
        ...config.pointsPerQuestion,
        [questionNumber]: Math.max(0.5, point),
      },
    });
  };

  const setAllPointsEqual = (pts: number) => {
    const newPoints: Record<number, number> = {};
    for (let q = 1; q <= config.totalQuestions; q++) {
      newPoints[q] = pts;
    }
    updateConfig({ pointsPerQuestion: newPoints });
    showToast(`ตั้งค่าให้ทุกข้อมีคะแนนเต็ม ${pts} คะแนนเท่ากันแล้ว`);
  };

  const randomizeSampleAnswerKeys = () => {
    const choices = CHOICE_KEYS_ABCD.slice(0, config.choicesCount);
    const newKeys: Record<number, string> = {};
    for (let q = 1; q <= config.totalQuestions; q++) {
      newKeys[q] = choices[Math.floor(Math.random() * choices.length)];
    }
    const nextExamSets = { ...(config.examSets || {}) };
    nextExamSets[currentSet] = newKeys;

    updateConfig({
      answerKeys: newKeys,
      examSets: nextExamSets,
    });
    showToast(`สุ่มเฉลยตัวอย่างสำหรับชุด "${currentSet}" แล้ว`);
  };

  // Exam Bank Modal Handlers
  const handleSaveCurrentToBank = () => {
    const saved = saveExamBankTemplate(config, {
      title: saveTitle.trim() || config.title,
      academicYear: saveYear,
      term: saveTerm,
      teacherId: effectiveTeacherId,
      teacherName: config.teacherName || effectiveTeacherName,
      workspaceId: workspaceId,
      isSharedToSchool: saveSharedToSchool,
    });
    setBankTemplates(getExamBankTemplates());
    showToast(`บันทึกชุดข้อสอบ "${saved.title}" เข้าคลังชุดข้อสอบเรียบร้อยแล้ว`);
  };

  const handleToggleShare = (templateId: string) => {
    const updated = toggleShareExamBankTemplate(templateId);
    setBankTemplates(updated);
    showToast('ปรับสถานะการแชร์ข้อสอบเข้าคลังส่วนกลางแล้ว');
  };

  const handleLoadFromBank = (template: ExamBankTemplate) => {
    const loadedConfig: AnswerSheetConfig = {
      ...config,
      title: template.title,
      subjectName: template.subjectName,
      schoolName: template.schoolName || config.schoolName,
      teacherId: template.teacherId || effectiveTeacherId,
      teacherName: template.teacherName || effectiveTeacherName,
      academicYear: template.academicYear,
      term: template.term,
      isUniversalRoom: template.isUniversalRoom !== false,
      roomName: template.roomName || '',
      totalQuestions: template.totalQuestions,
      choicesCount: template.choicesCount,
      choiceLabelType: template.choiceLabelType,
      layout: template.layout,
      studentIdFormat: template.studentIdFormat,
      totalScore: template.totalScore,
      themeColor: template.themeColor || 'slate',
      examSet: template.examSet || '01',
      examSets: template.examSets || { [template.examSet || '01']: template.answerKeys },
      answerKeys: template.answerKeys,
      pointsPerQuestion: template.pointsPerQuestion,
    };

    updateConfig(loadedConfig);
    setShowExamBankModal(false);
    showToast(`โหลดชุดข้อสอบ "${template.title}" มาใช้งานเรียบร้อยแล้ว`);
  };

  const handleDeleteFromBank = (templateId: string, title: string) => {
    if (!confirm(`คุณต้องการลบชุดข้อสอบ "${title}" ออกจากคลังใช่หรือไม่?`)) return;
    const remaining = deleteExamBankTemplate(templateId);
    setBankTemplates(remaining);
    showToast(`ลบชุดข้อสอบออกจากคลังแล้ว`);
  };

  const handleExportBankFile = () => {
    exportExamBankToJson();
    showToast('ดาวน์โหลดไฟล์สำรองคลังชุดข้อสอบ (.json) สำเร็จ');
  };

  const handleImportBankFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const res = importExamBankFromJson(content, effectiveTeacherId, config.teacherName || effectiveTeacherName);
      if (res.success) {
        setBankTemplates(getExamBankTemplates());
        showToast(`นำเข้าชุดข้อสอบสำเร็จ ${res.count} รายการ`);
      } else {
        alert(res.error || 'นำเข้าไฟล์ไม่สำเร็จ');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadSampleSheet = () => {
    const canvas = generateSyntheticFilledSheet(config, {
      rollNumber: Math.floor(1 + Math.random() * 25),
      accuracyRate: 0.85,
    });
    const link = document.createElement('a');
    link.download = `OMR-Sample-${config.subjectName || 'Exam'}-Set${config.examSet || '01'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const choiceKeys = CHOICE_KEYS_ABCD.slice(0, config.choicesCount);

  // Filter templates for Exam Bank Modal
  const filteredTemplates = bankTemplates.filter((t) => {
    const matchSearch =
      t.title.toLowerCase().includes(bankSearch.toLowerCase()) ||
      t.subjectName.toLowerCase().includes(bankSearch.toLowerCase()) ||
      (t.teacherName && t.teacherName.toLowerCase().includes(bankSearch.toLowerCase())) ||
      (t.schoolName && t.schoolName.toLowerCase().includes(bankSearch.toLowerCase()));
    const matchYear = bankYearFilter === 'all' || t.academicYear === bankYearFilter;
    const matchScope =
      bankScope === 'my_exams'
        ? t.teacherId === effectiveTeacherId || !t.teacherId
        : t.isSharedToSchool === true;
    return matchSearch && matchYear && matchScope;
  });

  const uniqueYears = Array.from(new Set(bankTemplates.map((t) => t.academicYear || '2568'))).sort().reverse();

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-xs font-bold text-white shadow-xl animate-in slide-in-from-top-2">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Subtab Navigation & Quick Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveSubTab('settings')}
            className={`inline-flex h-9 items-center gap-2 rounded-xl px-3.5 text-xs font-black transition ${
              activeSubTab === 'settings'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Sliders size={14} />
            1. ตั้งค่ากระดาษคำตอบ & QR
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('answer_key')}
            className={`inline-flex h-9 items-center gap-2 rounded-xl px-3.5 text-xs font-black transition ${
              activeSubTab === 'answer_key'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Check size={14} />
            2. เฉลย & ชุดข้อสอบ ({availableSets.length} ชุด)
            <span className="rounded-md bg-cyan-100 px-1.5 py-0.5 text-[10px] font-bold text-cyan-800">
              {config.totalQuestions} ข้อ
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('preview')}
            className={`inline-flex h-9 items-center gap-2 rounded-xl px-3.5 text-xs font-black transition ${
              activeSubTab === 'preview'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <FileText size={14} />
            3. ดูตัวอย่าง & สั่งพิมพ์ A4
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Exam Bank Archive Button */}
          <button
            type="button"
            onClick={() => {
              setBankTemplates(getExamBankTemplates());
              setSaveTitle(config.title || '');
              setShowExamBankModal(true);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/80 px-3 text-xs font-black text-indigo-700 shadow-2xs hover:bg-indigo-100 transition"
            title="เปิดคลังชุดข้อสอบ จัดเก็บหรือนำชุดข้อสอบปีเก่ามาใช้ใหม่"
          >
            <FolderArchive size={14} className="text-indigo-600" />
            คลังชุดข้อสอบ ({bankTemplates.length})
          </button>

          <button
            type="button"
            onClick={handleDownloadSampleSheet}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
            title="ดาวน์โหลดภาพตัวอย่างกระดาษที่ฝนแล้วเพื่อนำไปทดลองสแกน"
          >
            <Download size={13} className="text-slate-500" />
            ดาวน์โหลดตัวอย่างฝน
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-900 bg-slate-900 px-3.5 text-xs font-black text-white shadow-xs hover:bg-slate-800 transition"
          >
            <Printer size={13} />
            สั่งพิมพ์ (Print A4)
          </button>

          <button
            type="button"
            onClick={onStartScanning}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 text-xs font-black text-white shadow-sm hover:from-emerald-500 hover:to-teal-500 transition"
          >
            <Play size={13} />
            สแกนตรวจข้อสอบ
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {/* Subtab 1: Settings Form */}
      {activeSubTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-6">
            {/* Exam Information Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <FileText size={16} className="text-cyan-600" />
                ข้อมูลหัวกระดาษคำตอบ & รหัสข้อสอบ
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ชื่อการสอบ / แบบทดสอบ
                  </label>
                  <input
                    type="text"
                    value={config.title}
                    onChange={(e) => updateConfig({ title: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 outline-none"
                    placeholder="เช่น แบบทดสอบวัดผลสัมฤทธิ์ปลายภาคเรียนที่ 1/2568"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ชื่อรายวิชา</label>
                  <input
                    type="text"
                    value={config.subjectName}
                    onChange={(e) => updateConfig({ subjectName: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 outline-none"
                    placeholder="เช่น วิทยาศาสตร์และเทคโนโลยี"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">วันที่สอบ</label>
                  <input
                    type="date"
                    value={config.examDate}
                    onChange={(e) => updateConfig({ examDate: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 outline-none"
                  />
                </div>

                {/* Academic Year & Semester for Archive */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ปีการศึกษา (Academic Year)</label>
                  <input
                    type="text"
                    value={config.academicYear || '2568'}
                    onChange={(e) => updateConfig({ academicYear: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 outline-none"
                    placeholder="2568"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ภาคเรียน (Term / Semester)</label>
                  <select
                    value={config.term || '1'}
                    onChange={(e) => updateConfig({ term: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 outline-none bg-white"
                  >
                    <option value="1">ภาคเรียนที่ 1</option>
                    <option value="2">ภาคเรียนที่ 2</option>
                    <option value="summer">ภาคฤดูร้อน (Summer)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ชื่อโรงเรียน / สถานศึกษา (School Name)
                  </label>
                  <input
                    type="text"
                    value={config.schoolName || ''}
                    onChange={(e) => updateConfig({ schoolName: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 outline-none"
                    placeholder="เช่น โรงเรียน ClassCare 360 (หรือเว้นว่างเพื่อใช้ชื่อสถานศึกษามาตรฐาน)"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ครูผู้สอน / ผู้ออกข้อสอบ (Teacher ID & Name)
                  </label>
                  <div className="relative">
                    <User size={14} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={config.teacherName ?? effectiveTeacherName}
                      onChange={(e) => updateConfig({ teacherName: e.target.value, teacherId: effectiveTeacherId })}
                      className="w-full rounded-xl border border-slate-200 pl-8 pr-3 py-2 text-xs font-bold text-slate-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 outline-none"
                      placeholder="เช่น ครูภูรินัฐ กุลพบุรี"
                    />
                  </div>
                </div>

                {/* Universal Room vs Specific Room */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    การระบุห้องเรียนบนหัวกระดาษคำตอบ
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => updateConfig({ isUniversalRoom: true, roomName: '' })}
                      className={`flex flex-col text-left rounded-xl p-3 border transition ${
                        config.isUniversalRoom !== false
                          ? 'border-2 border-cyan-600 bg-cyan-50/80 shadow-2xs font-bold text-cyan-950'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-xs font-black flex items-center gap-1.5">
                        🌐 กระดาษคำตอบกลาง (ใช้ได้ทุกห้อง)
                      </span>
                      <span className="text-[11px] text-slate-500 font-normal mt-0.5">
                        ไม่พิมพ์ชื่อห้องลงบนหัวกระดาษ ให้นักเรียนกรอกห้องและเลขที่ด้วยตนเอง (แนะนำสำหรับพิมพ์แจกทุกชั้น)
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => updateConfig({ isUniversalRoom: false })}
                      className={`flex flex-col text-left rounded-xl p-3 border transition ${
                        config.isUniversalRoom === false
                          ? 'border-2 border-cyan-600 bg-cyan-50/80 shadow-2xs font-bold text-cyan-950'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-xs font-black flex items-center gap-1.5">
                        🏫 ระบุห้องเรียนเฉพาะ
                      </span>
                      <span className="text-[11px] text-slate-500 font-normal mt-0.5">
                        พิมพ์ชื่อห้องเรียนลงบนหัวกระดาษ เหมาะสำหรับการสอบเฉพาะห้อง
                      </span>
                    </button>
                  </div>

                  {config.isUniversalRoom === false && (
                    <div className="mt-2.5">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        ระบุชื่อชั้น / ห้องเรียนที่จะพิมพ์ลงกระดาษ
                      </label>
                      <input
                        type="text"
                        value={config.roomName || ''}
                        onChange={(e) => updateConfig({ roomName: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 outline-none"
                        placeholder="เช่น ประถมศึกษาปีที่ 5/1 หรือ ม.3/2"
                      />
                    </div>
                  )}
                </div>

                {/* QR Code Machine Recognition Box */}
                <div className="sm:col-span-2 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <QrCode size={16} className="text-indigo-600" />
                      <span className="text-xs font-black text-indigo-950">
                        QR Code หัวกระดาษสำหรับระบบตรวจอัตโนมัติ
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.showQrCode !== false}
                        onChange={(e) => updateConfig({ showQrCode: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                  <p className="text-[11px] text-indigo-800 leading-relaxed font-normal">
                    ระบบจะสร้าง QR Code เฉพาะของข้อสอบชุดนี้ (เข้ารหัส: รหัสการสอบ, ชุดข้อสอบ เช่น <strong>ชุด {currentSet}</strong>, วิชา, และจำนวนข้อ)
                    เพื่อให้กล้องสแกนตรวจจับชุดข้อสอบได้อัตโนมัติ 100% ไม่ต้องเลือกชุดด้วยมือ
                  </p>
                </div>

                {/* Official Theme Color Selector */}
                <div className="sm:col-span-2 pt-1 border-t border-slate-100">
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    ธีมสีกระดาษคำตอบแบบมาตรฐานทางการ
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      {
                        key: 'slate' as const,
                        name: 'มินิมอล ขาว-ดำ (แนะนำ)',
                        desc: 'เรียบง่าย สะอาดตา ประหยัดหมึก',
                        color: 'bg-slate-900',
                        border: 'border-slate-900',
                      },
                      {
                        key: 'navy' as const,
                        name: 'น้ำเงินสุภาพ (Navy)',
                        desc: 'โทนสีน้ำเงิน เรียบร้อย สบายตา',
                        color: 'bg-blue-900',
                        border: 'border-blue-900',
                      },
                      {
                        key: 'burgundy' as const,
                        name: 'แดงเลือดหมู (Burgundy)',
                        desc: 'สีคลาสสิก สไตล์ข้อสอบวัดผล',
                        color: 'bg-[#701a2b]',
                        border: 'border-[#701a2b]',
                      },
                      {
                        key: 'emerald' as const,
                        name: 'เขียวธรรมชาติ (Emerald)',
                        desc: 'โทนเขียว สบายตา ไม่ฉูดฉาด',
                        color: 'bg-emerald-800',
                        border: 'border-emerald-800',
                      },
                    ].map((t) => {
                      const isSelected = (config.themeColor || 'slate') === t.key;
                      return (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => updateConfig({ themeColor: t.key })}
                          className={`flex flex-col text-left rounded-xl p-2.5 border transition ${
                            isSelected
                              ? `border-2 ${t.border} bg-slate-50 shadow-2xs font-black`
                              : 'border-slate-200 bg-white hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={`inline-block h-3.5 w-3.5 rounded-full ${t.color}`} />
                            <span className="text-xs text-slate-900 font-bold">{t.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-500">{t.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Layout & Format Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Sliders size={16} className="text-cyan-600" />
                โครงสร้างกระดาษคำตอบ
              </h3>

              {/* Total Questions Preset Buttons */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  จำนวนข้อสอบ (Questions)
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {[10, 20, 30, 40, 50, 60].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => handleTotalQuestionsChange(count)}
                      className={`flex flex-col items-center justify-center rounded-xl p-2.5 text-xs font-black transition ${
                        config.totalQuestions === count
                          ? 'border-2 border-cyan-600 bg-cyan-50 text-cyan-900 shadow-2xs'
                          : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-base font-black">{count}</span>
                      <span className="text-[10px] font-semibold text-slate-500">ข้อ</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Choice Count & Label Format */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    จำนวนตัวเลือกต่อข้อ
                  </label>
                  <div className="flex gap-2">
                    {[
                      { count: 4, label: '4 ตัวเลือก (มาตรฐาน)' },
                      { count: 5, label: '5 ตัวเลือก' },
                    ].map((item) => (
                      <button
                        key={item.count}
                        type="button"
                        onClick={() => updateConfig({ choicesCount: item.count as 4 | 5 })}
                        className={`flex-1 rounded-xl p-2.5 text-xs font-black transition text-center ${
                          config.choicesCount === item.count
                            ? 'border-2 border-cyan-600 bg-cyan-50 text-cyan-900 shadow-2xs'
                            : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    รูปแบบตัวอักษรในวงกลม
                  </label>
                  <div className="flex gap-2">
                    {[
                      { type: 'ABCD' as ChoiceLabelType, label: 'A B C D' },
                      { type: 'THAI' as ChoiceLabelType, label: 'ก ข ค ง' },
                    ].map((item) => (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => updateConfig({ choiceLabelType: item.type })}
                        className={`flex-1 rounded-xl p-2.5 text-xs font-black transition text-center ${
                          config.choiceLabelType === item.type
                            ? 'border-2 border-cyan-600 bg-cyan-50 text-cyan-900 shadow-2xs'
                            : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Student Identification Style */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  การระบุตัวตนบนกระดาษคำตอบ
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    {
                      format: 'roll_number' as StudentIdFormat,
                      title: 'มีช่องฝนเลขที่ (01 - 99)',
                      desc: 'แนะนำสำหรับนักเรียนในห้อง ตรวจจับและจับคู่รายชื่ออัตโนมัติ',
                    },
                    {
                      format: 'student_code' as StudentIdFormat,
                      title: 'รหัสประจำตัว 5 หลัก',
                      desc: 'ช่องฝนเลข 5 หลัก สำหรับระบบทะเบียนโรงเรียนทางการ',
                    },
                    {
                      format: 'none' as StudentIdFormat,
                      title: 'ไม่มีช่องฝนรหัส',
                      desc: 'เหมาะสำหรับแบบทดสอบนิรนาม สอบควิซ หรือกรอกชื่อด้วยลายมือ',
                    },
                  ].map((item) => (
                    <button
                      key={item.format}
                      type="button"
                      onClick={() => updateConfig({ studentIdFormat: item.format })}
                      className={`flex flex-col text-left rounded-xl p-3 border transition ${
                        config.studentIdFormat === item.format
                          ? 'border-2 border-cyan-600 bg-cyan-50/70 shadow-2xs'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-xs font-black text-slate-900">{item.title}</span>
                      <span className="text-[11px] text-slate-500 mt-1">{item.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Eco Half Page Layout Option */}
              {config.totalQuestions <= 30 && (
                <div className="pt-2">
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    รูปแบบการจัดวางหน้าพิมพ์
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => updateConfig({ layout: 'single_full' })}
                      className={`p-3 rounded-xl border text-left transition ${
                        config.layout === 'single_full'
                          ? 'border-2 border-cyan-600 bg-cyan-50'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <span className="text-xs font-black text-slate-900 block">เต็มแผ่น A4 (Standard)</span>
                      <span className="text-[11px] text-slate-500">1 ชุดต่อ 1 แผ่น ตัวหนังสือใหญ่ชัดเจน</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateConfig({ layout: 'eco_half' })}
                      className={`p-3 rounded-xl border text-left transition ${
                        config.layout === 'eco_half'
                          ? 'border-2 border-emerald-600 bg-emerald-50'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <span className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                        <Layers size={13} className="text-emerald-600" />
                        ประหยัดกระดาษ 2-in-1 (Eco Saver)
                      </span>
                      <span className="text-[11px] text-slate-500">ปริ้นต์ 1 แผ่น A4 ได้ 2 ชุด ประหยัดงบ 50%</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Preview Thumbnail */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                  ภาพจำลองกระดาษคำตอบ (ชุด {currentSet})
                </h3>
                <span className="text-[11px] font-bold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded">
                  {config.totalQuestions} ข้อ • รวม {config.totalScore} คะแนน
                </span>
              </div>

              {/* Scaled Mini Preview */}
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 p-2 shadow-inner">
                <div className="origin-top scale-[0.45] w-[210mm] pointer-events-none mb-[-140%]">
                  <PrintableAnswerSheet config={config} schoolName={workspaceName} isMiniPreview={true} />
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('preview')}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white py-2 text-xs font-black text-slate-700 hover:bg-slate-50 transition"
                >
                  <FileText size={13} />
                  เปิดดูขนาดเต็ม & พิมพ์
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('answer_key')}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 py-2 text-xs font-black text-white hover:bg-slate-800 transition"
                >
                  <Check size={13} />
                  ไปกำหนดเฉลยต่อ
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subtab 2: Answer Key & Multi-Set Management */}
      {activeSubTab === 'answer_key' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            {/* Multi-Set Tab Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
                  <Layers3 size={14} className="text-indigo-600" />
                  ชุดข้อสอบ (Exam Sets):
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {availableSets.map((s) => (
                    <div key={s} className="inline-flex items-center rounded-xl overflow-hidden border border-slate-200">
                      <button
                        type="button"
                        onClick={() => handleSwitchSet(s)}
                        className={`px-3 py-1 text-xs font-black transition ${
                          currentSet === s
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'bg-white text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        ชุด {s}
                      </button>
                      {availableSets.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteSet(s)}
                          className="px-1.5 py-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition border-l border-slate-200"
                          title={`ลบชุด ${s}`}
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={handleAddSet}
                    className="inline-flex items-center gap-1 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/50 px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition"
                  >
                    <Plus size={13} />
                    เพิ่มชุดข้อสอบใหม่
                  </button>
                </div>
              </div>

              {/* Quick Actions for Current Set */}
              <div className="flex flex-wrap items-center gap-2">
                {currentSet !== '01' && availableSets.includes('01') && (
                  <button
                    type="button"
                    onClick={() => handleCopyFromBaseSet('01')}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50"
                    title="คัดลอกเฉลยจากชุด 01"
                  >
                    <Copy size={12} className="text-slate-400" />
                    คัดลอกจากชุด 01
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleShuffleChoices}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50"
                  title="สลับช้อยส์เพื่อทำเป็นชุดคู่ขนานป้องกันการลอกข้อสอบ"
                >
                  <Shuffle size={12} className="text-indigo-500" />
                  สลับช้อยส์ป้องกันการลอก
                </button>

                <button
                  type="button"
                  onClick={randomizeSampleAnswerKeys}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50"
                >
                  <Sparkles size={12} className="text-amber-500" />
                  สุ่มเฉลยตัวอย่าง
                </button>

                <button
                  type="button"
                  onClick={() => setAllPointsEqual(1)}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50"
                >
                  <RotateCcw size={12} className="text-slate-400" />
                  ข้อละ 1 คะแนน
                </button>
              </div>
            </div>

            {/* Questions Grid with Interactive Answer Keys */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[580px] overflow-y-auto pr-1">
              {Array.from({ length: config.totalQuestions }).map((_, idx) => {
                const qNum = idx + 1;
                const selectedKey = config.answerKeys[qNum] || 'A';
                const point = config.pointsPerQuestion[qNum] ?? 1;

                return (
                  <div
                    key={qNum}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 transition hover:border-cyan-300 hover:bg-white"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-900 text-xs font-mono font-black text-white">
                        {qNum}
                      </span>

                      {/* Bubble choices */}
                      <div className="flex gap-1">
                        {choiceKeys.map((cKey, cIdx) => {
                          const isSelected = selectedKey === cKey;
                          const label = getChoiceLabel(cIdx, config.choiceLabelType);
                          return (
                            <button
                              key={cKey}
                              type="button"
                              onClick={() => handleAnswerKeySelect(qNum, cKey)}
                              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black transition ${
                                isSelected
                                  ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-300 scale-105'
                                  : 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Point input */}
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0.5"
                        max="10"
                        step="0.5"
                        value={point}
                        onChange={(e) => handlePointWeightChange(qNum, parseFloat(e.target.value) || 1)}
                        className="w-12 rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-center text-xs font-bold text-slate-800 outline-none focus:border-cyan-500"
                        title="คะแนนเต็มของข้อนี้"
                      />
                      <span className="text-[10px] text-slate-500">คะแนน</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Subtab 3: Printable High Resolution Preview & Multi-Set Print */}
      {activeSubTab === 'preview' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-cyan-50 border border-cyan-200 p-3 text-xs text-cyan-900">
            <div className="flex items-center gap-3">
              <div>
                <span className="font-black">พร้อมพิมพ์:</span> ขนาด A4 พอดีหน้า 100% พร้อม QR Code ตรวจจับชุดอัตโนมัติ
              </div>
              {availableSets.length > 1 && (
                <div className="flex items-center gap-1.5 bg-white/80 px-2 py-1 rounded-lg border border-cyan-300">
                  <span className="font-bold text-slate-700">กำลังดู:</span>
                  <select
                    value={config.examSet || '01'}
                    onChange={(e) => handleSwitchSet(e.target.value)}
                    className="font-black text-indigo-700 bg-transparent outline-none cursor-pointer"
                  >
                    {availableSets.map((s) => (
                      <option key={s} value={s}>
                        ชุดที่ {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {availableSets.length > 1 && (
                <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white px-2.5 py-1.5 rounded-lg border border-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={previewAllSets}
                    onChange={(e) => setPreviewAllSets(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  พิมพ์ทุกชุดต่อเนื่อง ({availableSets.length} ชุด)
                </label>
              )}

              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3.5 py-1.5 text-xs font-black text-white hover:bg-slate-800"
              >
                <Printer size={13} />
                สั่งพิมพ์เดี๋ยวนี้ (Print A4)
              </button>
            </div>
          </div>

          {/* Render One Set or All Sets */}
          <div className="overflow-x-auto rounded-2xl border border-slate-300 bg-slate-200 p-6 flex flex-col items-center gap-8">
            {previewAllSets ? (
              availableSets.map((s) => (
                <div key={s} className="space-y-1">
                  <div className="text-center font-bold text-xs text-slate-600">กระดาษคำตอบ ชุดที่ {s}</div>
                  <PrintableAnswerSheet
                    config={{
                      ...config,
                      examSet: s,
                      answerKeys: config.examSets?.[s] || config.answerKeys,
                    }}
                    schoolName={workspaceName}
                  />
                </div>
              ))
            ) : (
              <PrintableAnswerSheet config={config} schoolName={workspaceName} />
            )}
          </div>
        </div>
      ) : (
        /* Hidden from screen, but available when user triggers print from top action bar */
        <div className="hidden print:block">
          {previewAllSets ? (
            availableSets.map((s) => (
              <div key={s} className="break-after-page">
                <PrintableAnswerSheet
                  config={{
                    ...config,
                    examSet: s,
                    answerKeys: config.examSets?.[s] || config.answerKeys,
                  }}
                  schoolName={workspaceName}
                />
              </div>
            ))
          ) : (
            <PrintableAnswerSheet config={config} schoolName={workspaceName} />
          )}
        </div>
      )}

      {/* --- EXAM BANK ARCHIVE MODAL --- */}
      {showExamBankModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-900 to-indigo-950 p-5 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  <FolderArchive size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">คลังชุดข้อสอบและกระดาษคำตอบ (Exam Bank)</h3>
                  <p className="text-xs text-indigo-200">
                    บันทึกชุดข้อสอบ จัดการเฉลยทุกชุด และนำกลับมาใช้ใหม่ในปีการศึกษาถัดไปได้ทันที
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportBankFile}
                  className="inline-flex items-center gap-1 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20 transition"
                  title="ส่งออกไฟล์คลังข้อสอบเป็น JSON สำหรับสำรองข้อมูลหรือย้ายเครื่อง"
                >
                  <Download size={13} />
                  ส่งออกไฟล์ JSON
                </button>

                <label className="inline-flex items-center gap-1 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20 transition cursor-pointer">
                  <Upload size={13} />
                  นำเข้าไฟล์ JSON
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleImportBankFile}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => setShowExamBankModal(false)}
                  className="rounded-xl p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition ml-2"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto p-6 space-y-6">
              {/* Teacher Scope Switcher Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBankScope('my_exams')}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition ${
                      bankScope === 'my_exams'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <User size={13} />
                    คลังข้อสอบของฉัน ({bankTemplates.filter((t) => t.teacherId === effectiveTeacherId || !t.teacherId).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setBankScope('school_shared')}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition ${
                      bankScope === 'school_shared'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Share2 size={13} />
                    คลังส่วนกลางโรงเรียน ({bankTemplates.filter((t) => t.isSharedToSchool).length})
                  </button>
                </div>

                <div className="text-[11px] text-slate-500 font-bold">
                  ครูปัจจุบัน: <strong className="text-slate-800">{config.teacherName || effectiveTeacherName}</strong> (ID: {effectiveTeacherId.slice(0, 10)})
                </div>
              </div>

              {/* Save Current Exam Section */}
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wide flex items-center gap-1.5">
                    <Sparkles size={14} className="text-indigo-600" />
                    บันทึกชุดข้อสอบที่กำลังออกแบบนี้เข้าคลัง (Save Current Exam)
                  </h4>
                  <span className="text-[11px] font-bold text-indigo-700">
                    {config.totalQuestions} ข้อ • {availableSets.length} ชุด ({availableSets.join(', ')}) • รวม {config.totalScore} คะแนน
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      value={saveTitle}
                      onChange={(e) => setSaveTitle(e.target.value)}
                      placeholder="ชื่อชุดข้อสอบ เช่น แบบทดสอบวัดผลปลายภาค วิทยาศาสตร์ ป.5"
                      className="w-full rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={saveYear}
                      onChange={(e) => setSaveYear(e.target.value)}
                      placeholder="ปีการศึกษา เช่น 2568"
                      className="w-full rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={handleSaveCurrentToBank}
                      className="w-full h-full rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-500 shadow-xs transition"
                    >
                      บันทึกเข้าคลังทันที
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 text-xs">
                  <label className="flex items-center gap-1.5 font-bold text-indigo-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveSharedToSchool}
                      onChange={(e) => setSaveSharedToSchool(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    แชร์เข้าคลังส่วนกลางโรงเรียน (ให้ครูท่านอื่นในโรงเรียนสามารถนำไปใช้งานต่อได้)
                  </label>
                  <span className="text-[11px] text-indigo-600 font-semibold">
                    บันทึกในชื่อ: {config.teacherName || effectiveTeacherName}
                  </span>
                </div>
              </div>

              {/* Search & Filter Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[220px]">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={bankSearch}
                    onChange={(e) => setBankSearch(e.target.value)}
                    placeholder="ค้นหาชื่อชุดข้อสอบ, รายวิชา, ชื่อครูผู้ออกข้อสอบ..."
                    className="w-full rounded-xl border border-slate-200 pl-8 pr-3 py-1.5 text-xs text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                    <Calendar size={13} />
                    ปีการศึกษา:
                  </span>
                  <select
                    value={bankYearFilter}
                    onChange={(e) => setBankYearFilter(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 outline-none"
                  >
                    <option value="all">ทั้งหมด ทุกปีการศึกษา</option>
                    {uniqueYears.map((yr) => (
                      <option key={yr} value={yr}>
                        ปีการศึกษา {yr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Saved Templates List */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-wide">
                  ชุดข้อสอบที่บันทึกไว้ในคลัง ({filteredTemplates.length} รายการ)
                </h4>

                {filteredTemplates.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-400">
                    <FolderArchive size={32} className="mx-auto mb-2 text-slate-300" />
                    <p className="text-xs font-bold">ไม่พบชุดข้อสอบในคลังตามคำค้นหา</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredTemplates.map((t) => {
                      const setsList = t.examSets ? Object.keys(t.examSets).sort() : [t.examSet || '01'];
                      const isCurrentActive = config.title === t.title && config.totalQuestions === t.totalQuestions;
                      const isOwner = t.teacherId === effectiveTeacherId || !t.teacherId;

                      return (
                        <div
                          key={t.id}
                          className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-indigo-300 transition space-y-3"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <h5 className="text-xs font-black text-slate-900 leading-snug">{t.title}</h5>
                              <span className="shrink-0 rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-black text-indigo-700 border border-indigo-200">
                                ปี {t.academicYear || '2568'} / เทอม {t.term || '1'}
                              </span>
                            </div>

                            <p className="text-[11px] font-semibold text-slate-500 mt-1">
                              วิชา: <strong className="text-slate-700">{t.subjectName}</strong>
                              {t.teacherName ? (
                                <span> • ครูผู้ออกข้อสอบ: <strong className="text-indigo-800">{t.teacherName}</strong></span>
                              ) : null}
                              {t.schoolName ? ` • ${t.schoolName}` : ''}
                            </p>

                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                                {t.totalQuestions} ข้อ
                              </span>
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                                รวม {t.totalScore} คะแนน
                              </span>
                              <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                                {setsList.length} ชุด ({setsList.map((s) => `ชุด ${s}`).join(', ')})
                              </span>
                              {t.isSharedToSchool ? (
                                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                  <Share2 size={10} /> แชร์ส่วนกลาง
                                </span>
                              ) : (
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 flex items-center gap-1">
                                  <Lock size={10} /> ส่วนตัว
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                            <span className="text-[10px] text-slate-400">
                              บันทึกเมื่อ: {new Date(t.savedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                            </span>

                            <div className="flex items-center gap-1.5">
                              {isOwner && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleShare(t.id)}
                                  className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold border transition ${
                                    t.isSharedToSchool
                                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                                  }`}
                                  title={t.isSharedToSchool ? 'แชร์สู่ส่วนกลางแล้ว (คลิกเพื่อยกเลิก)' : 'ส่วนตัว (คลิกเพื่อแชร์เข้าส่วนกลาง)'}
                                >
                                  {t.isSharedToSchool ? <Share2 size={11} className="text-emerald-600" /> : <Lock size={11} className="text-slate-400" />}
                                  {t.isSharedToSchool ? 'แชร์ส่วนกลาง' : 'ส่วนตัว'}
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleDeleteFromBank(t.id, t.title)}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                                title="ลบออกจากคลัง"
                              >
                                <Trash2 size={13} />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleLoadFromBank(t)}
                                className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-black transition ${
                                  isCurrentActive
                                    ? 'bg-emerald-600 text-white shadow-2xs'
                                    : 'bg-slate-900 text-white hover:bg-indigo-600'
                                }`}
                              >
                                {isCurrentActive ? (
                                  <>
                                    <Check size={12} />
                                    กำลังเปิดใช้งาน
                                  </>
                                ) : (
                                  <>
                                    <FolderArchive size={12} />
                                    โหลดมาใช้งาน
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
