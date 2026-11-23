import { type Dispatch, type SetStateAction, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  ClipboardList,
  Edit3,
  HelpCircle,
  MoreVertical,
  Pin,
  Plus,
  Search,
  Sparkles,
  Table,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';

export type GradebookScoreBand = 'coursework' | 'midterm' | 'final';

export interface GradebookAssessmentLike {
  category: string;
  id: string;
  max_score: number;
  metadata?: Record<string, unknown> | null;
  title: string;
  weight: number;
}

export interface GradebookStudentLike {
  first_name: string;
  id: string;
  last_name: string;
  nickname: string | null;
  student_code: string | null;
}

export interface GradebookEntryLike {
  score: number | null;
  student_id: string;
}

export interface GradebookBandSummaryLike {
  key: GradebookScoreBand;
  label: string;
  plannedWeight: number;
  recommendedWeight: number;
}

export interface ThaiGradeBadgeInfo {
  badgeClass: string;
  grade: string;
  label: string;
}

interface ModernGradebookSheetProps<T extends GradebookAssessmentLike> {
  assessments: T[];
  classroomName?: string;
  entriesByAssessment: Map<string, GradebookEntryLike[]>;
  formatScore: (value: number) => string;
  getScoreBand: (assessment: T) => GradebookScoreBand;
  getThaiGrade: (percent: number | null | undefined) => ThaiGradeBadgeInfo;
  gridScores: Record<string, string>;
  isStickyRoster: boolean;
  onAddAssessment: () => void;
  onChangeGridScores: Dispatch<SetStateAction<Record<string, string>>>;
  onDeleteAssessment: (assessment: T) => void;
  onEditAssessment: (assessment: T) => void;
  onNotice: (message: string) => void;
  onOpenAssessmentEntry: (assessmentId: string) => void;
  onOpenAssessmentOcr: (assessmentId: string) => void;
  onOpenRatioModal: () => void;
  onSearchTermChange: (value: string) => void;
  onToggleStickyRoster: () => void;
  plannedTotalWeight: number;
  scoreBandSummaries: GradebookBandSummaryLike[];
  searchTerm: string;
  studentSeatNumberMap?: Map<string, number>;
  students: GradebookStudentLike[];
  totalStudentsCount?: number;
}

interface BandVisualConfig {
  barClass: string;
  dotClass: string;
  headerClass: string;
  key: GradebookScoreBand;
  label: string;
}

const BAND_CONFIGS: BandVisualConfig[] = [
  {
    barClass: 'bg-emerald-500',
    dotClass: 'bg-emerald-500',
    headerClass: 'bg-emerald-50/85 text-emerald-900 border-emerald-200/80',
    key: 'coursework',
    label: 'ระหว่างเรียน',
  },
  {
    barClass: 'bg-amber-500',
    dotClass: 'bg-amber-500',
    headerClass: 'bg-amber-50/85 text-amber-900 border-amber-200/80',
    key: 'midterm',
    label: 'กลางภาค',
  },
  {
    barClass: 'bg-violet-500',
    dotClass: 'bg-violet-500',
    headerClass: 'bg-violet-50/85 text-violet-900 border-violet-200/80',
    key: 'final',
    label: 'ปลายภาค',
  },
];

interface ColumnMenuState<T extends GradebookAssessmentLike> {
  assessment: T;
  left: number;
  top: number;
}

export function ModernGradebookSheet<T extends GradebookAssessmentLike>({
  assessments,
  classroomName,
  entriesByAssessment,
  formatScore,
  getScoreBand,
  getThaiGrade,
  gridScores,
  isStickyRoster,
  onAddAssessment,
  onChangeGridScores,
  onDeleteAssessment,
  onEditAssessment,
  onNotice,
  onOpenAssessmentEntry,
  onOpenAssessmentOcr,
  onOpenRatioModal,
  onSearchTermChange,
  onToggleStickyRoster,
  plannedTotalWeight,
  scoreBandSummaries,
  searchTerm,
  studentSeatNumberMap,
  students,
  totalStudentsCount,
}: ModernGradebookSheetProps<T>) {
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [columnMenu, setColumnMenu] = useState<ColumnMenuState<T> | null>(null);
  const shortcutsRef = useRef<HTMLDivElement | null>(null);
  const columnMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isShortcutsOpen && !columnMenu) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (isShortcutsOpen && shortcutsRef.current && !shortcutsRef.current.contains(target)) {
        setIsShortcutsOpen(false);
      }
      if (columnMenu && columnMenuRef.current && !columnMenuRef.current.contains(target)) {
        const triggerEl = (event.target as HTMLElement | null)?.closest?.('[data-col-menu-trigger]');
        if (!triggerEl) {
          setColumnMenu(null);
        }
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsShortcutsOpen(false);
        setColumnMenu(null);
      }
    }

    function handleScroll() {
      setColumnMenu(null);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [columnMenu, isShortcutsOpen]);

  // O(1) lookup: assessmentId -> (studentId -> stored score)
  const storedScoreMap = useMemo(() => {
    const map = new Map<string, Map<string, number | null>>();
    entriesByAssessment.forEach((rows, assessmentId) => {
      const inner = new Map<string, number | null>();
      rows.forEach((row) => {
        inner.set(row.student_id, row.score);
      });
      map.set(assessmentId, inner);
    });
    return map;
  }, [entriesByAssessment]);

  // Order columns by OBEC band: coursework -> midterm -> final
  const visibleBandGroups = useMemo(() => {
    return BAND_CONFIGS.map((config) => {
      const items = assessments.filter((assessment) => getScoreBand(assessment) === config.key);
      const groupWeight = items.reduce((sum, item) => sum + item.weight, 0);
      return {
        ...config,
        groupWeight,
        items,
      };
    }).filter((group) => group.items.length > 0);
  }, [assessments, getScoreBand]);

  const orderedAssessments = useMemo(
    () => visibleBandGroups.flatMap((group) => group.items),
    [visibleBandGroups],
  );

  // Pre-compute live metrics for all rows and footer columns from one source of truth
  const sheetMetrics = useMemo(() => {
    const plannedTotal = orderedAssessments.reduce((sum, item) => sum + item.weight, 0);

    const rowComputations = students.map((student) => {
      let earnedTotal = 0;
      let hasAnyScore = false;

      orderedAssessments.forEach((assessment) => {
        const cellKey = `${student.id}::${assessment.id}`;
        const orig = storedScoreMap.get(assessment.id)?.get(student.id);
        const origStr = orig === null || orig === undefined ? '' : String(orig);
        const rawScore = gridScores[cellKey] ?? origStr;
        const num = rawScore === '' ? null : Number(rawScore);
        if (num !== null && Number.isFinite(num)) {
          hasAnyScore = true;
          const safeMax = assessment.max_score > 0 ? assessment.max_score : 100;
          earnedTotal += (num / safeMax) * assessment.weight;
        }
      });

      const finalPercent = plannedTotal > 0 ? (earnedTotal / plannedTotal) * 100 : 0;
      const gradeInfo = getThaiGrade(hasAnyScore ? finalPercent : null);
      return {
        earnedTotal,
        finalPercent,
        gradeInfo,
        hasAnyScore,
        plannedTotal,
      };
    });

    const columnStats = orderedAssessments.map((assessment) => {
      const values: number[] = [];
      students.forEach((student) => {
        const cellKey = `${student.id}::${assessment.id}`;
        const orig = storedScoreMap.get(assessment.id)?.get(student.id);
        const origStr = orig === null || orig === undefined ? '' : String(orig);
        const rawScore = gridScores[cellKey] ?? origStr;
        const num = rawScore === '' ? null : Number(rawScore);
        if (num !== null && Number.isFinite(num) && num >= 0 && num <= assessment.max_score) {
          values.push(num);
        }
      });

      const filledCount = values.length;
      const avg = filledCount > 0 ? values.reduce((sum, v) => sum + v, 0) / filledCount : null;
      const min = filledCount > 0 ? Math.min(...values) : null;
      const max = filledCount > 0 ? Math.max(...values) : null;

      return {
        avg,
        filledCount,
        max,
        min,
      };
    });

    const scoredRows = rowComputations.filter((row) => row.hasAnyScore);
    const scoredStudentCount = scoredRows.length;
    const avgEarned =
      scoredStudentCount > 0
        ? scoredRows.reduce((sum, row) => sum + row.earnedTotal, 0) / scoredStudentCount
        : null;
    const avgPercent =
      scoredStudentCount > 0
        ? scoredRows.reduce((sum, row) => sum + row.finalPercent, 0) / scoredStudentCount
        : null;
    const passedCount = scoredRows.filter((row) => row.finalPercent >= 50).length;

    return {
      avgEarned,
      avgPercent,
      columnStats,
      passedCount,
      plannedTotal,
      rowComputations,
      scoredStudentCount,
    };
  }, [getThaiGrade, gridScores, orderedAssessments, storedScoreMap, students]);

  function handleFillColumnMax(assessment: T) {
    if (students.length === 0) return;
    const nextUpdates: Record<string, string> = {};
    students.forEach((student) => {
      nextUpdates[`${student.id}::${assessment.id}`] = String(assessment.max_score);
    });
    onChangeGridScores((current) => ({ ...current, ...nextUpdates }));
    setColumnMenu(null);
    onNotice(`เติมคะแนนเต็ม (${assessment.max_score}) ช่อง "${assessment.title}" ทั้งคอลัมน์แล้ว อย่าลืมกดบันทึก`);
  }

  function handleOpenColumnMenu(assessment: T, buttonEl: HTMLButtonElement) {
    if (columnMenu?.assessment.id === assessment.id) {
      setColumnMenu(null);
      return;
    }
    const rect = buttonEl.getBoundingClientRect();
    const menuWidth = 224;
    const left = Math.max(12, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 12));
    const top = Math.min(rect.bottom + 6, window.innerHeight - 230);
    setColumnMenu({ assessment, left, top });
  }

  const effectiveTotalStudents = totalStudentsCount ?? students.length;
  const isFiltered = searchTerm.trim().length > 0;

  return (
    <div className="rounded-2xl border border-[#E5E8E1] bg-white shadow-sm">
      {/* Attached Compact Sheet Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-2xl border-b border-slate-200 bg-[#FAFBF8] px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          {/* Compact Search */}
          <label className="relative flex h-8 w-44 sm:w-56 items-center rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-100">
            <Search size={13} className="pointer-events-none absolute left-2.5 text-slate-400" aria-hidden="true" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              placeholder="ค้นหาชื่อ เลขที่ รหัส..."
              className="h-full w-full bg-transparent pl-8 pr-7 text-xs font-semibold text-slate-800 outline-none placeholder:text-slate-400"
            />
            {isFiltered ? (
              <button
                type="button"
                onClick={() => onSearchTermChange('')}
                className="absolute right-1.5 rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                title="ล้างคำค้นหา"
                aria-label="ล้างคำค้นหา"
              >
                <X size={12} aria-hidden="true" />
              </button>
            ) : null}
          </label>

          {/* Interactive 3-Band OBEC Weight Summary Pill */}
          <button
            type="button"
            onClick={onOpenRatioModal}
            title="คลิกเพื่อตั้งค่าสัดส่วนคะแนน ปพ.5 (ระหว่างเรียน : กลางภาค : ปลายภาค)"
            className="inline-flex h-8 flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 text-[11px] font-bold text-slate-700 transition hover:border-cyan-400 hover:bg-cyan-50/40"
          >
            {scoreBandSummaries.map((band) => {
              const visual = BAND_CONFIGS.find((c) => c.key === band.key) || BAND_CONFIGS[0];
              return (
                <span key={band.key} className="inline-flex items-center gap-1">
                  <span className={`h-1.5 w-1.5 rounded-full ${visual.dotClass}`} aria-hidden="true" />
                  <span className="hidden md:inline text-slate-500">{band.label}</span>
                  <span className="font-mono font-black text-slate-800">
                    {band.plannedWeight}/{band.recommendedWeight}
                  </span>
                </span>
              );
            })}
            <span className="h-3.5 w-px bg-slate-200" aria-hidden="true" />
            <span
              className={`font-black ${
                plannedTotalWeight === 100 ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              รวม {plannedTotalWeight}/100
            </span>
          </button>

          {classroomName ? (
            <span className="hidden xl:inline-flex items-center rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">
              ห้อง {classroomName} · {isFiltered ? `${students.length}/${effectiveTotalStudents}` : effectiveTotalStudents} คน · {orderedAssessments.length} ช่อง
            </span>
          ) : null}
        </div>

        {/* Right Controls: Shortcuts Popover + Sticky Pin */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="relative" ref={shortcutsRef}>
            <button
              type="button"
              onClick={() => setIsShortcutsOpen((prev) => !prev)}
              aria-expanded={isShortcutsOpen}
              className={`inline-flex h-8 items-center gap-1 rounded-xl border px-2.5 text-[11px] font-black transition ${
                isShortcutsOpen
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
              title="ดูคีย์ลัดและวิธีวางคะแนนจาก Excel"
            >
              <HelpCircle size={13} aria-hidden="true" />
              <span className="hidden sm:inline">คีย์ลัด Excel</span>
            </button>

            {isShortcutsOpen ? (
              <div className="absolute right-0 top-[calc(100%+0.4rem)] z-40 w-72 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xl text-xs">
                <p className="font-black text-slate-900">วิธีกรอกคะแนนแบบเร็วในตาราง</p>
                <div className="mt-2.5 space-y-2 text-[11px] font-semibold text-slate-600">
                  <div className="flex items-center justify-between gap-2">
                    <span>เลื่อนไปช่องขวาถัดไป</span>
                    <kbd className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-black text-slate-800">
                      Tab
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span>เลื่อนลงนักเรียนคนถัดไป</span>
                    <kbd className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-black text-slate-800">
                      Enter / ↓
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span>เลื่อนขึ้น-ซ้าย-ขวา</span>
                    <kbd className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-black text-slate-800">
                      ← ↑ → ↓
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span>วางคะแนนจาก Excel ได้ทั้งแถบ</span>
                    <kbd className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-black text-slate-800">
                      Ctrl+V / ⌘V
                    </kbd>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onToggleStickyRoster}
            className={`inline-flex h-8 items-center gap-1 rounded-xl border px-2.5 text-[11px] font-black transition ${
              isStickyRoster
                ? 'border-cyan-300 bg-cyan-50 text-cyan-900'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
            title="เปิด/ปิดการตรึงคอลัมน์ชื่อนักเรียนเมื่อเลื่อนตารางแนวนอน"
          >
            {isStickyRoster ? <Pin size={12} aria-hidden="true" /> : <Unlock size={12} aria-hidden="true" />}
            <span>{isStickyRoster ? 'ตรึงชื่อ' : 'ปลดตรึง'}</span>
          </button>
        </div>
      </div>

      {/* Spreadsheet Area */}
      {orderedAssessments.length > 0 ? (
        <div className="overflow-x-auto rounded-b-2xl">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              {/* Tier 1: OBEC Band Group Headers */}
              <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-black text-slate-700">
                <th
                  rowSpan={2}
                  className={`${
                    isStickyRoster ? 'sticky left-0 z-20' : 'static'
                  } w-11 min-w-[44px] border-r border-slate-200 bg-slate-100 px-1.5 py-2 text-center align-middle whitespace-nowrap`}
                >
                  เลขที่
                </th>
                <th
                  rowSpan={2}
                  className={`${
                    isStickyRoster ? 'sticky left-11 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]' : 'static'
                  } w-44 sm:w-52 min-w-[160px] sm:min-w-[208px] border-r border-slate-200 bg-slate-100 px-2.5 py-2 align-middle whitespace-nowrap`}
                >
                  ชื่อ - นามสกุล
                </th>

                {visibleBandGroups.map((group) => (
                  <th
                    key={group.key}
                    colSpan={group.items.length}
                    className={`border-r border-b px-2.5 py-1.5 text-center whitespace-nowrap ${group.headerClass}`}
                  >
                    {group.label}{' '}
                    <span className="font-mono text-[10px] opacity-80">({group.groupWeight}%)</span>
                  </th>
                ))}

                {/* Inline + Add Column Header (absorbs remaining horizontal space when 1-2 assessments) */}
                <th
                  rowSpan={2}
                  className="min-w-[96px] border-r border-slate-200 bg-slate-50/70 px-2 py-2 align-middle"
                >
                  <button
                    type="button"
                    onClick={onAddAssessment}
                    className="inline-flex h-8 items-center gap-1 rounded-xl border border-dashed border-slate-300 bg-white px-2.5 text-[11px] font-black text-slate-600 transition hover:border-cyan-500 hover:bg-cyan-50 hover:text-cyan-800 whitespace-nowrap"
                    title="เพิ่มช่องคะแนนใหม่ในวิชานี้"
                  >
                    <Plus size={13} aria-hidden="true" />
                    <span>เพิ่มช่อง</span>
                  </button>
                </th>

                <th
                  colSpan={3}
                  className="border-b border-slate-200 bg-cyan-50/80 px-2 py-1.5 text-center text-cyan-900 whitespace-nowrap"
                >
                  สรุปผล (สด)
                </th>
              </tr>

              {/* Tier 2: Individual Assessment Columns + Summary Sub-headers */}
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600">
                {orderedAssessments.map((assessment, aIdx) => {
                  const stats = sheetMetrics.columnStats[aIdx];
                  const fillPercent = students.length > 0 ? Math.round((stats.filledCount / students.length) * 100) : 0;
                  const band = getScoreBand(assessment);
                  const bandVisual = BAND_CONFIGS.find((c) => c.key === band) || BAND_CONFIGS[0];
                  const isMenuOpen = columnMenu?.assessment.id === assessment.id;

                  return (
                    <th
                      key={assessment.id}
                      className="w-[130px] min-w-[130px] max-w-[144px] border-r border-slate-200 bg-white px-2 py-1.5 align-top"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span
                          className="line-clamp-1 flex-1 text-[11px] font-black text-slate-900"
                          title={assessment.title}
                        >
                          {aIdx + 1}. {assessment.title}
                        </span>
                        <button
                          type="button"
                          data-col-menu-trigger="true"
                          onClick={(event) => handleOpenColumnMenu(assessment, event.currentTarget)}
                          className={`-mr-1 shrink-0 rounded-md p-0.5 transition ${
                            isMenuOpen
                              ? 'bg-slate-900 text-white'
                              : 'text-slate-400 hover:bg-slate-100 hover:text-slate-800'
                          }`}
                          title="ตัวเลือกช่องคะแนนนี้"
                          aria-label={`ตัวเลือกช่อง ${assessment.title}`}
                        >
                          <MoreVertical size={13} aria-hidden="true" />
                        </button>
                      </div>

                      <div className="mt-1 flex items-center justify-between gap-1 text-[10px] font-bold text-slate-500">
                        <span>
                          เต็ม <strong className="text-slate-800">{assessment.max_score}</strong> ({assessment.weight}%)
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">
                          {stats.filledCount}/{students.length}
                        </span>
                      </div>

                      <div
                        className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-100"
                        title={`กรอกแล้ว ${stats.filledCount} จาก ${students.length} คน (${fillPercent}%)`}
                      >
                        <div
                          className={`h-full rounded-full transition-all ${bandVisual.barClass}`}
                          style={{ width: `${fillPercent}%` }}
                        />
                      </div>
                    </th>
                  );
                })}

                <th className="w-[86px] min-w-[86px] border-r border-slate-200 bg-slate-100/80 px-2 py-2 text-center font-black text-slate-700 whitespace-nowrap">
                  รวม
                </th>
                <th className="w-[70px] min-w-[70px] border-r border-slate-200 bg-slate-100/80 px-2 py-2 text-center font-black text-slate-700 whitespace-nowrap">
                  ร้อยละ
                </th>
                <th className="w-[84px] min-w-[84px] bg-cyan-50/70 px-2 py-2 text-center font-black text-cyan-900 whitespace-nowrap">
                  เกรด 0–4
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {students.length > 0 ? (
                students.map((student, sIdx) => {
                  const rowMetric = sheetMetrics.rowComputations[sIdx];
                  const seatNumber = studentSeatNumberMap?.get(student.id) ?? sIdx + 1;

                  return (
                    <tr key={student.id} className="group transition-colors hover:bg-cyan-50/25">
                      {/* Ordinal Seat Number */}
                      <td
                        className={`${
                          isStickyRoster ? 'sticky left-0 z-10' : 'static'
                        } border-r border-slate-200 bg-white px-1.5 py-1 text-center font-mono text-[11px] font-bold text-slate-500 group-hover:bg-slate-50`}
                      >
                        {seatNumber}
                      </td>

                      {/* Student Name + Compact Code & Nickname */}
                      <td
                        className={`${
                          isStickyRoster
                            ? 'sticky left-11 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]'
                            : 'static'
                        } border-r border-slate-200 bg-white px-2.5 py-1.5 group-hover:bg-slate-50`}
                      >
                        <p
                          className="truncate text-xs font-bold text-slate-900"
                          title={`${student.first_name} ${student.last_name}`}
                        >
                          <span>{student.first_name}</span>{' '}
                          <span className="hidden sm:inline">{student.last_name}</span>
                        </p>
                        {student.student_code || student.nickname ? (
                          <p className="truncate text-[10px] font-medium text-slate-400">
                            {student.student_code ? <span className="font-mono">#{student.student_code}</span> : null}
                            {student.student_code && student.nickname ? ' · ' : null}
                            {student.nickname ? `(${student.nickname})` : null}
                          </p>
                        ) : null}
                      </td>

                      {/* Borderless-until-focus Full-Cell Score Inputs */}
                      {orderedAssessments.map((assessment, aIdx) => {
                        const cellKey = `${student.id}::${assessment.id}`;
                        const orig = storedScoreMap.get(assessment.id)?.get(student.id);
                        const origScore = orig === null || orig === undefined ? '' : String(orig);
                        const currentVal = gridScores[cellKey] ?? origScore;
                        const isModified = currentVal !== origScore;
                        const numVal = currentVal === '' ? null : Number(currentVal);
                        const isInvalid =
                          numVal !== null && (!Number.isFinite(numVal) || numVal < 0 || numVal > assessment.max_score);

                        return (
                          <td
                            key={assessment.id}
                            className={`border-r border-slate-200 px-1 py-0.5 ${
                              isInvalid ? 'bg-rose-50/70' : isModified ? 'bg-amber-50/70' : ''
                            }`}
                          >
                            <input
                              aria-label={`คะแนน ${student.first_name} ${student.last_name} - ${assessment.title}`}
                              className={`h-8 w-full rounded-md border text-center font-mono text-xs font-bold outline-none transition ${
                                isInvalid
                                  ? 'border-rose-400 bg-rose-50 text-rose-700 focus:ring-2 focus:ring-rose-200'
                                  : isModified
                                    ? 'border-amber-300 bg-white text-slate-950 shadow-2xs focus:border-amber-500 focus:ring-2 focus:ring-amber-200'
                                    : 'border-transparent bg-transparent text-slate-800 hover:bg-slate-100/80 focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100'
                              }`}
                              data-grid-row={sIdx}
                              data-grid-col={aIdx}
                              max={assessment.max_score}
                              min="0"
                              onChange={(event) => {
                                const val = event.target.value;
                                onChangeGridScores((current) => ({ ...current, [cellKey]: val }));
                              }}
                              onKeyDown={(event) => {
                                const input = event.target as HTMLInputElement;
                                if (event.key === 'ArrowDown' || event.key === 'Enter') {
                                  event.preventDefault();
                                  document
                                    .querySelector<HTMLInputElement>(
                                      `[data-grid-row="${sIdx + 1}"][data-grid-col="${aIdx}"]`,
                                    )
                                    ?.focus();
                                } else if (event.key === 'ArrowUp') {
                                  event.preventDefault();
                                  document
                                    .querySelector<HTMLInputElement>(
                                      `[data-grid-row="${sIdx - 1}"][data-grid-col="${aIdx}"]`,
                                    )
                                    ?.focus();
                                } else if (
                                  event.key === 'ArrowRight' &&
                                  (input.selectionStart === null || input.selectionStart === input.value.length)
                                ) {
                                  event.preventDefault();
                                  document
                                    .querySelector<HTMLInputElement>(
                                      `[data-grid-row="${sIdx}"][data-grid-col="${aIdx + 1}"]`,
                                    )
                                    ?.focus();
                                } else if (
                                  event.key === 'ArrowLeft' &&
                                  (input.selectionStart === null || input.selectionStart === 0)
                                ) {
                                  event.preventDefault();
                                  document
                                    .querySelector<HTMLInputElement>(
                                      `[data-grid-row="${sIdx}"][data-grid-col="${aIdx - 1}"]`,
                                    )
                                    ?.focus();
                                }
                              }}
                              onPaste={(event) => {
                                const clipText = event.clipboardData.getData('text');
                                const rows = clipText.split(/\r?\n/).filter((r) => r.length > 0);
                                if (rows.length === 1 && !rows[0].includes('\t')) return;

                                event.preventDefault();
                                const nextUpdates: Record<string, string> = {};
                                let pasteCount = 0;

                                rows.forEach((rowStr, rOffset) => {
                                  const targetStudent = students[sIdx + rOffset];
                                  if (!targetStudent) return;
                                  const cols = rowStr.split('\t');
                                  cols.forEach((colVal, cOffset) => {
                                    const targetAssessment = orderedAssessments[aIdx + cOffset];
                                    if (!targetAssessment) return;
                                    const trimmed = colVal.trim();
                                    const nVal = Number(trimmed);
                                    if (
                                      trimmed === '' ||
                                      (Number.isFinite(nVal) && nVal >= 0 && nVal <= targetAssessment.max_score)
                                    ) {
                                      nextUpdates[`${targetStudent.id}::${targetAssessment.id}`] = trimmed;
                                      pasteCount += 1;
                                    }
                                  });
                                });

                                onChangeGridScores((current) => ({ ...current, ...nextUpdates }));
                                onNotice(`วางข้อมูลจาก Excel ลงตารางสำเร็จ (${pasteCount} เซลล์) อย่าลืมกดบันทึก`);
                              }}
                              placeholder="·"
                              step="any"
                              type="number"
                              value={currentVal}
                            />
                          </td>
                        );
                      })}

                      {/* Spacer cell under Inline + เพิ่มช่อง */}
                      <td className="border-r border-slate-200 bg-slate-50/25 px-2 py-1" />

                      {/* Right Live Summary Columns */}
                      <td className="border-r border-slate-200 bg-slate-50/40 px-2 py-1 text-center font-mono text-[11px] font-black text-slate-800 whitespace-nowrap">
                        {rowMetric.hasAnyScore ? (
                          <>
                            {formatScore(rowMetric.earnedTotal)}{' '}
                            <span className="font-normal text-slate-400">/{formatScore(rowMetric.plannedTotal)}</span>
                          </>
                        ) : (
                          <span className="font-sans font-normal text-slate-300">-</span>
                        )}
                      </td>

                      <td className="border-r border-slate-200 px-2 py-1 text-center whitespace-nowrap">
                        {rowMetric.hasAnyScore ? (
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ring-1 ${
                              rowMetric.finalPercent < 50
                                ? 'bg-rose-50 text-rose-700 ring-rose-200'
                                : rowMetric.finalPercent < 70
                                  ? 'bg-amber-50 text-amber-700 ring-amber-200'
                                  : 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                            }`}
                          >
                            {rowMetric.finalPercent.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-300">-</span>
                        )}
                      </td>

                      <td className="bg-cyan-50/30 px-2 py-1 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-black ring-1 ${rowMetric.gradeInfo.badgeClass}`}
                          title={rowMetric.gradeInfo.label}
                        >
                          {rowMetric.hasAnyScore ? `เกรด ${rowMetric.gradeInfo.grade}` : 'รอคะแนน'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={orderedAssessments.length + 6}
                    className="px-4 py-8 text-center text-xs font-bold text-slate-500"
                  >
                    <p>
                      {isFiltered
                        ? `ไม่พบนักเรียนที่ตรงกับคำค้นหา "${searchTerm}"`
                        : 'ยังไม่มีรายชื่อนักเรียนในห้องเรียนนี้'}
                    </p>
                    {isFiltered ? (
                      <button
                        type="button"
                        onClick={() => onSearchTermChange('')}
                        className="mt-2 inline-flex h-8 items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50"
                      >
                        แสดงนักเรียนทั้งหมด
                      </button>
                    ) : null}
                  </td>
                </tr>
              )}
            </tbody>

            {/* Class Summary Footer */}
            {students.length > 0 ? (
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-700">
                  <td
                    colSpan={2}
                    className={`${
                      isStickyRoster ? 'sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]' : 'static'
                    } border-r border-slate-200 bg-slate-100 px-3 py-2 font-black text-slate-800 whitespace-nowrap`}
                  >
                    เฉลี่ยห้อง ({students.length} คน)
                  </td>

                  {orderedAssessments.map((assessment, aIdx) => {
                    const stats = sheetMetrics.columnStats[aIdx];
                    return (
                      <td key={assessment.id} className="border-r border-slate-200 px-2 py-1.5 text-center">
                        {stats.avg !== null ? (
                          <div>
                            <p className="font-mono font-black text-slate-900">เฉลี่ย {stats.avg.toFixed(1)}</p>
                            <p className="text-[10px] font-semibold text-slate-400">
                              ต่ำสุด {formatScore(stats.min ?? 0)}–สูงสุด {formatScore(stats.max ?? 0)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    );
                  })}

                  <td className="border-r border-slate-200 px-2 py-1.5" />

                  <td className="border-r border-slate-200 px-2 py-1.5 text-center font-mono whitespace-nowrap">
                    {sheetMetrics.avgEarned !== null ? (
                      <span>
                        <strong className="text-slate-900">{sheetMetrics.avgEarned.toFixed(1)}</strong>{' '}
                        <span className="font-normal text-slate-400">/{formatScore(sheetMetrics.plannedTotal)}</span>
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>

                  <td className="border-r border-slate-200 px-2 py-1.5 text-center font-mono font-black text-slate-900 whitespace-nowrap">
                    {sheetMetrics.avgPercent !== null ? `${sheetMetrics.avgPercent.toFixed(1)}%` : '-'}
                  </td>

                  <td className="bg-cyan-50/50 px-2 py-1.5 text-center font-black text-cyan-900 whitespace-nowrap">
                    {sheetMetrics.scoredStudentCount > 0
                      ? `ผ่าน ${sheetMetrics.passedCount}/${sheetMetrics.scoredStudentCount}`
                      : '-'}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      ) : (
        <div className="px-4 py-12 text-center">
          <Table className="mx-auto text-slate-300" size={34} aria-hidden="true" />
          <h3 className="mt-2.5 text-sm font-black text-slate-800">ยังไม่มีช่องคะแนนในวิชานี้</h3>
          <p className="mt-1 text-xs font-medium text-slate-500">
            สร้างช่องคะแนนแรกเพื่อเริ่มกรอกคะแนนในตารางรวมแบบสเปรดชีต
          </p>
          <button
            type="button"
            onClick={onAddAssessment}
            className="mt-3.5 inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-cyan-600 px-4 text-xs font-black text-white shadow-2xs transition hover:bg-cyan-700"
          >
            <Plus size={14} aria-hidden="true" />
            <span>เพิ่มช่องคะแนนแรก</span>
          </button>
        </div>
      )}

      {/* Fixed-Position Column Action Menu (never clipped by overflow-x-auto) */}
      {columnMenu ? (
        <div
          ref={columnMenuRef}
          role="menu"
          aria-label={`จัดการช่อง ${columnMenu.assessment.title}`}
          style={{ left: `${columnMenu.left}px`, top: `${columnMenu.top}px` }}
          className="fixed z-50 w-56 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl text-xs"
        >
          <div className="border-b border-slate-100 px-2.5 py-1.5 mb-1">
            <p className="truncate font-black text-slate-900">{columnMenu.assessment.title}</p>
            <p className="text-[10px] font-bold text-slate-400">
              เต็ม {columnMenu.assessment.max_score} · น้ำหนัก {columnMenu.assessment.weight}%
            </p>
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={() => handleFillColumnMax(columnMenu.assessment)}
            className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left font-bold text-slate-800 transition hover:bg-cyan-50 hover:text-cyan-900"
          >
            <Sparkles size={14} className="shrink-0 text-cyan-600" aria-hidden="true" />
            <span>ให้เต็มทั้งคอลัมน์ ({columnMenu.assessment.max_score})</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              const id = columnMenu.assessment.id;
              setColumnMenu(null);
              onOpenAssessmentOcr(id);
            }}
            className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left font-bold text-slate-800 transition hover:bg-slate-50"
          >
            <Camera size={14} className="shrink-0 text-indigo-600" aria-hidden="true" />
            <span>สแกนใบคะแนน AI ช่องนี้</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              const id = columnMenu.assessment.id;
              setColumnMenu(null);
              onOpenAssessmentEntry(id);
            }}
            className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left font-bold text-slate-800 transition hover:bg-slate-50"
          >
            <ClipboardList size={14} className="shrink-0 text-emerald-600" aria-hidden="true" />
            <span>กรอกทีละคน / ใส่หมายเหตุ</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              const target = columnMenu.assessment;
              setColumnMenu(null);
              onEditAssessment(target);
            }}
            className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left font-bold text-slate-800 transition hover:bg-slate-50"
          >
            <Edit3 size={14} className="shrink-0 text-slate-600" aria-hidden="true" />
            <span>แก้ไขชื่อ / เต็ม / น้ำหนัก</span>
          </button>

          <div className="my-1 border-t border-slate-100" />

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              const target = columnMenu.assessment;
              setColumnMenu(null);
              onDeleteAssessment(target);
            }}
            className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left font-bold text-rose-700 transition hover:bg-rose-50"
          >
            <Trash2 size={14} className="shrink-0 text-rose-600" aria-hidden="true" />
            <span>ลบช่องคะแนนนี้</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
