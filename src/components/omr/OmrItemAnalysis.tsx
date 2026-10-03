import { useMemo } from 'react';
import {
  BarChart3,
  Download,
  AlertTriangle,
  Award,
  Users,
} from 'lucide-react';
import type { AnswerSheetConfig, ScannedExamResult } from '../../types/omr';
import { calculateItemAnalysis, CHOICE_KEYS_ABCD, getChoiceLabel } from '../../lib/omrEngine';

interface OmrItemAnalysisProps {
  config: AnswerSheetConfig;
  results: ScannedExamResult[];
}

export function OmrItemAnalysis({ config, results }: OmrItemAnalysisProps) {
  const itemStats = useMemo(() => {
    return calculateItemAnalysis(results, config);
  }, [results, config]);

  const summary = useMemo(() => {
    if (results.length === 0) {
      return { total: 0, avgScore: 0, highest: 0, lowest: 0, passCount: 0, passRate: 0 };
    }
    const scores = results.map((r) => r.totalScore);
    const total = results.length;
    const sum = scores.reduce((a, b) => a + b, 0);
    const avgScore = Math.round((sum / total) * 10) / 10;
    const highest = Math.max(...scores);
    const lowest = Math.min(...scores);
    const passThreshold = config.totalScore * 0.5; // 50%
    const passCount = scores.filter((s) => s >= passThreshold).length;
    const passRate = Math.round((passCount / total) * 100);

    return { total, avgScore, highest, lowest, passCount, passRate };
  }, [results, config]);

  const choiceKeys = CHOICE_KEYS_ABCD.slice(0, config.choicesCount);

  const handleExportCsv = () => {
    if (results.length === 0) return;
    const headers = [
      'ลำดับ',
      'วันที่สแกน',
      'เลขที่/รหัส',
      'ชื่อ-สกุล',
      'คะแนนที่ได้',
      'คะแนนเต็ม',
      'ร้อยละ',
      'ข้อที่ถูก',
      'ข้อที่ผิด',
      'ข้อที่เว้นว่าง',
      'สถานะ',
    ];
    const rows = results.map((r, i) => [
      i + 1,
      new Date(r.scannedAt).toLocaleString('th-TH'),
      r.studentRollNumber ?? r.studentCode ?? '-',
      `"${r.studentName.replace(/"/g, '""')}"`,
      r.totalScore,
      r.maxScore,
      `${r.percentage}%`,
      r.correctCount,
      r.incorrectCount,
      r.blankCount,
      r.status,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `OMR-Results-${config.subjectName || 'Exam'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (results.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
        <BarChart3 className="mx-auto text-slate-300" size={48} />
        <h3 className="mt-3 text-base font-black text-slate-800">ยังไม่มีข้อมูลการสแกนตรวจข้อสอบ</h3>
        <p className="mt-1 text-xs text-slate-500">
          เมื่อท่านทำการสแกนกระดาษคำตอบด้วยกล้องหรืออัปโหลดภาพ ระบบจะประมวลผลสถิติและวิเคราะห์ความยากง่ายของข้อสอบให้ที่นี่ทันที
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold">
            <Users size={14} className="text-cyan-600" />
            ตรวจแล้วทั้งหมด
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">
            {summary.total} <span className="text-xs font-bold text-slate-500">คน</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold">
            <BarChart3 size={14} className="text-emerald-600" />
            คะแนนเฉลี่ย
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-600">
            {summary.avgScore}{' '}
            <span className="text-xs font-bold text-slate-500">/ {config.totalScore}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold">
            <Award size={14} className="text-amber-500" />
            คะแนนสูงสุด
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">
            {summary.highest} <span className="text-xs font-bold text-slate-500">คะแนน</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold">
            <AlertTriangle size={14} className="text-rose-500" />
            คะแนนต่ำสุด
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">
            {summary.lowest} <span className="text-xs font-bold text-slate-500">คะแนน</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold">
            <Users size={14} className="text-blue-600" />
            สอบผ่าน (≥ 50%)
          </div>
          <div className="mt-2 text-2xl font-black text-blue-600">
            {summary.passCount} <span className="text-xs font-bold text-slate-500">คน</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold">
            <Award size={14} className="text-indigo-600" />
            อัตราการผ่าน
          </div>
          <div className="mt-2 text-2xl font-black text-indigo-600">{summary.passRate}%</div>
        </div>
      </div>

      {/* Item Analysis Breakdown Table */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <BarChart3 size={16} className="text-cyan-600" />
              การวิเคราะห์รายข้อ (Item Analysis & Difficulty Index)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              แสดงการกระจายตัวของตัวเลือกที่นักเรียนตอบ และค่าความยากง่ายของข้อสอบแต่ละข้อ
            </p>
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
          >
            <Download size={13} className="text-slate-500" />
            ส่งออกผลคะแนนเป็น CSV / Excel
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-black uppercase text-slate-600">
                <th className="py-2.5 px-3">ข้อที่</th>
                <th className="py-2.5 px-2 text-center">เฉลย</th>
                <th className="py-2.5 px-3 text-center">ตอบถูก</th>
                <th className="py-2.5 px-3 text-center">ตอบผิด</th>
                <th className="py-2.5 px-3 text-center">การกระจายตัวเลือก (Choice Distribution)</th>
                <th className="py-2.5 px-3 text-center">ดัชนีความยาก (p)</th>
                <th className="py-2.5 px-3 text-center">ระดับความยาก</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {itemStats.map((stat) => {
                const isTough = stat.difficultyIndex < 0.3;
                const isEasy = stat.difficultyIndex > 0.8;

                return (
                  <tr key={stat.questionNumber} className="hover:bg-slate-50/70 transition">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                      ข้อ {stat.questionNumber}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-black text-white">
                        {getChoiceLabel(
                          CHOICE_KEYS_ABCD.indexOf(stat.correctChoice),
                          config.choiceLabelType
                        )}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-emerald-600">
                      {stat.correctCount}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-rose-500">
                      {stat.incorrectCount}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center justify-center gap-2">
                        {choiceKeys.map((cKey, cIdx) => {
                          const count = stat.choiceDistribution[cKey] || 0;
                          const isCorrect = cKey === stat.correctChoice;
                          return (
                            <div
                              key={cKey}
                              className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] ${
                                isCorrect
                                  ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200'
                                  : count > 0
                                  ? 'bg-slate-100 text-slate-700'
                                  : 'text-slate-300'
                              }`}
                            >
                              <span>{getChoiceLabel(cIdx, config.choiceLabelType)}:</span>
                              <span className="font-mono">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800">
                      {stat.difficultyIndex.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-[10.5px] font-bold ${
                          isTough
                            ? 'bg-rose-100 text-rose-800'
                            : isEasy
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {stat.difficultyLabel}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
