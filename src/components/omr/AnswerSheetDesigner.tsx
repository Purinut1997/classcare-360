import { useState } from 'react';
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
} from 'lucide-react';
import type { AnswerSheetConfig, ChoiceLabelType, StudentIdFormat } from '../../types/omr';
import { CHOICE_KEYS_ABCD, generateSyntheticFilledSheet, getChoiceLabel } from '../../lib/omrEngine';
import { PrintableAnswerSheet } from './PrintableAnswerSheet';

interface AnswerSheetDesignerProps {
  config: AnswerSheetConfig;
  onChangeConfig: (newConfig: AnswerSheetConfig) => void;
  onStartScanning: () => void;
  workspaceName?: string;
}

export function AnswerSheetDesigner({
  config,
  onChangeConfig,
  onStartScanning,
  workspaceName = 'โรงเรียนต้นแบบ ClassCare 360',
}: AnswerSheetDesignerProps) {
  const [activeSubTab, setActiveSubTab] = useState<'settings' | 'answer_key' | 'preview'>('settings');

  const updateConfig = (updates: Partial<AnswerSheetConfig>) => {
    const updated = { ...config, ...updates };
    // Recalculate total score
    let totalScore = 0;
    for (let q = 1; q <= updated.totalQuestions; q++) {
      totalScore += updated.pointsPerQuestion[q] ?? 1;
    }
    updated.totalScore = totalScore;
    onChangeConfig(updated);
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
      // If <= 30 questions, default eco_half can be an option
      layout: count <= 30 ? config.layout : 'single_full',
    });
  };

  const handleAnswerKeySelect = (questionNumber: number, choice: string) => {
    updateConfig({
      answerKeys: {
        ...config.answerKeys,
        [questionNumber]: choice,
      },
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
  };

  const randomizeSampleAnswerKeys = () => {
    const choices = CHOICE_KEYS_ABCD.slice(0, config.choicesCount);
    const newKeys: Record<number, string> = {};
    for (let q = 1; q <= config.totalQuestions; q++) {
      newKeys[q] = choices[Math.floor(Math.random() * choices.length)];
    }
    updateConfig({ answerKeys: newKeys });
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
    link.download = `OMR-Sample-${config.subjectName || 'Exam'}-RollSample.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const choiceKeys = CHOICE_KEYS_ABCD.slice(0, config.choicesCount);

  return (
    <div className="space-y-6">
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
            1. ตั้งค่ากระดาษคำตอบ
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
            2. กำหนดเฉลย (Answer Key)
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
            3. ดูตัวอย่างกระดาษ & สั่งพิมพ์
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadSampleSheet}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
            title="ดาวน์โหลดภาพตัวอย่างกระดาษที่ฝนแล้วเพื่อนำไปทดลองสแกน"
          >
            <Download size={13} className="text-slate-500" />
            ดาวน์โหลดภาพตัวอย่างฝนแล้ว
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
            พร้อมแล้ว สแกนตรวจข้อสอบ
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
                ข้อมูลหัวกระดาษคำตอบ
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
                    placeholder="เช่น แบบทดสอบวัดผลกลางภาคเรียนที่ 1/2568"
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

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ระดับชั้น / ห้องเรียน</label>
                  <input
                    type="text"
                    value={config.roomName || ''}
                    onChange={(e) => updateConfig({ roomName: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 outline-none"
                    placeholder="เช่น ประถมศึกษาปีที่ 5/1"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">รหัสชุดข้อสอบ (Set No.)</label>
                  <input
                    type="text"
                    value={config.examSet || '01'}
                    onChange={(e) => updateConfig({ examSet: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 outline-none"
                    placeholder="เช่น 01, 02 หรือ A, B"
                  />
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
                  ภาพจำลองกระดาษคำตอบ
                </h3>
                <span className="text-[11px] font-bold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded">
                  {config.totalQuestions} ข้อ • รวม {config.totalScore} คะแนน
                </span>
              </div>

              {/* Scaled Mini Preview */}
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 p-2 shadow-inner">
                <div className="origin-top scale-[0.45] w-[210mm] pointer-events-none mb-[-140%]">
                  <PrintableAnswerSheet config={config} schoolName={workspaceName} />
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

      {/* Subtab 2: Answer Key & Points Rubric */}
      {activeSubTab === 'answer_key' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Check size={16} className="text-emerald-600" />
                  ตารางกำหนดเฉลยและน้ำหนักคะแนน (Answer Key & Scoring Rubric)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  คลิกเลือกตัวเลือกที่ถูกต้องสำหรับแต่ละข้อ ระบบจะใช้เฉลยนี้ในการตรวจนับคะแนนอัตโนมัติ
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={randomizeSampleAnswerKeys}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50"
                  title="สุ่มเฉลยตัวอย่างเพื่อทดสอบระบบ"
                >
                  <Sparkles size={13} className="text-amber-500" />
                  สุ่มเฉลยตัวอย่าง
                </button>
                <button
                  type="button"
                  onClick={() => setAllPointsEqual(1)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50"
                >
                  <RotateCcw size={13} className="text-slate-400" />
                  ตั้งข้อละ 1 คะแนนทั้งหมด
                </button>
              </div>
            </div>

            {/* Questions Grid with Interactive Answer Keys */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[580px] overflow-y-auto pr-1">
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

      {/* Subtab 3: Printable High Resolution Preview */}
      {activeSubTab === 'preview' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl bg-cyan-50 border border-cyan-200 p-3 text-xs text-cyan-900">
            <div>
              <span className="font-black">พร้อมพิมพ์:</span> กระดาษคำตอบขนาด A4
              มีจุดมาร์กเกอร์สีดำที่ 4 มุมสำหรับการจัดตำแหน่งกล้องอย่างแม่นยำ
            </div>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-black text-white hover:bg-slate-800"
            >
              <Printer size={13} />
              สั่งพิมพ์เดี๋ยวนี้ (Print A4)
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-300 bg-slate-200 p-6 flex justify-center">
            <PrintableAnswerSheet config={config} schoolName={workspaceName} />
          </div>
        </div>
      )}
    </div>
  );
}
