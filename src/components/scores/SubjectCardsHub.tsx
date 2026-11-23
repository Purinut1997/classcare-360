import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Briefcase,
  Calculator,
  Camera,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  FlaskConical,
  Globe2,
  GraduationCap,
  HeartPulse,
  Languages,
  Lock,
  Palette,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { ContextLink as Link } from '../navigation/ContextLink';
import { OBEC_LEARNING_AREAS } from '../../types/academic';

export interface SubjectHubClassroom {
  id: string;
  name: string;
  academic_year?: string | null;
  isHomeroom?: boolean;
  studentCount: number;
}

export interface SubjectCardClassroomItem {
  id: string;
  name: string;
  subjectCode?: string | null;
  assessmentCount?: number;
  completionPercent?: number;
}

export interface SubjectCardItem {
  key: string;
  subjectName: string;
  subjectCode: string | null;
  subjectCodesByGrade?: string[];
  learningArea: string | null;
  credit: number | null;
  hoursPerYear: number | null;
  gradeLevel: string | null;
  classrooms: SubjectCardClassroomItem[];
  assessmentCount: number;
  plannedWeight: number;
  completionPercent: number;
  hasOfficialRecord: boolean;
}

export interface SubjectCardsHubProps {
  cards: SubjectCardItem[];
  classrooms: SubjectHubClassroom[];
  selectedClassroomId: string;
  onSelectClassroomFilter: (classroomId: string) => void;
  onOpenSubject: (card: SubjectCardItem, targetClassroomId?: string) => void;
  onDeleteSubject?: (card: SubjectCardItem) => Promise<boolean>;
  onQuickAddSubject: (payload: {
    subjectCode: string;
    subjectName: string;
    learningArea: string;
    credit: number;
    hoursPerYear: number;
    gradeLevel: string;
    applyToAllGrades?: boolean;
  }) => Promise<boolean>;
  onLoadObecDefaults: () => Promise<void>;
  onOpenAcademicSubjectsModal: () => void;
  onOpenOfficialDocuments: () => void;
  onOpenTermClosing: () => void;
  onOpenRubricModal: () => void;
  onOpenGuide: () => void;
  isLoadingSubjects?: boolean;
  isBusy?: boolean;
  hasOfficialSubjects: boolean;
  defaultGradeLevel: string;
}

interface SubjectTheme {
  gradientClass: string;
  borderClass: string;
  iconBgClass: string;
  codeBadgeClass: string;
  icon: LucideIcon;
}

function getSubjectTheme(learningArea: string | null, subjectName: string): SubjectTheme {
  const haystack = `${learningArea || ''} ${subjectName}`.toLowerCase();

  if (haystack.includes('คณิต')) {
    return {
      gradientClass: 'from-rose-50/90 via-pink-50/60 to-white',
      borderClass: 'border-rose-200/80 hover:border-rose-300',
      iconBgClass: 'bg-rose-100 text-rose-700',
      codeBadgeClass: 'bg-rose-100/80 text-rose-800 border-rose-200/80',
      icon: Calculator,
    };
  }
  if (haystack.includes('ภาษาไทย')) {
    return {
      gradientClass: 'from-indigo-50/90 via-violet-50/60 to-white',
      borderClass: 'border-indigo-200/80 hover:border-indigo-300',
      iconBgClass: 'bg-indigo-100 text-indigo-700',
      codeBadgeClass: 'bg-indigo-100/80 text-indigo-800 border-indigo-200/80',
      icon: BookOpen,
    };
  }
  if (
    haystack.includes('วิทยา') ||
    haystack.includes('เทคโน') ||
    haystack.includes('คอมพิวเตอร์')
  ) {
    return {
      gradientClass: 'from-amber-50/90 via-orange-50/55 to-white',
      borderClass: 'border-amber-200/80 hover:border-amber-300',
      iconBgClass: 'bg-amber-100 text-amber-800',
      codeBadgeClass: 'bg-amber-100/80 text-amber-900 border-amber-200/80',
      icon: FlaskConical,
    };
  }
  if (
    haystack.includes('สังคม') ||
    haystack.includes('ประวัติ') ||
    haystack.includes('หน้าที่')
  ) {
    return {
      gradientClass: 'from-emerald-50/90 via-teal-50/55 to-white',
      borderClass: 'border-emerald-200/80 hover:border-emerald-300',
      iconBgClass: 'bg-emerald-100 text-emerald-800',
      codeBadgeClass: 'bg-emerald-100/80 text-emerald-900 border-emerald-200/80',
      icon: Globe2,
    };
  }
  if (
    haystack.includes('อังกฤษ') ||
    haystack.includes('ต่างประเทศ') ||
    haystack.includes('จีน') ||
    haystack.includes('ญี่ปุ่น')
  ) {
    return {
      gradientClass: 'from-sky-50/90 via-cyan-50/55 to-white',
      borderClass: 'border-sky-200/80 hover:border-sky-300',
      iconBgClass: 'bg-sky-100 text-sky-700',
      codeBadgeClass: 'bg-sky-100/80 text-sky-900 border-sky-200/80',
      icon: Languages,
    };
  }
  if (haystack.includes('สุขศึกษา') || haystack.includes('พลศึกษา') || haystack.includes('พละ')) {
    return {
      gradientClass: 'from-orange-50/90 via-rose-50/45 to-white',
      borderClass: 'border-orange-200/80 hover:border-orange-300',
      iconBgClass: 'bg-orange-100 text-orange-700',
      codeBadgeClass: 'bg-orange-100/80 text-orange-900 border-orange-200/80',
      icon: HeartPulse,
    };
  }
  if (haystack.includes('ศิลป') || haystack.includes('ดนตรี') || haystack.includes('นาฏ')) {
    return {
      gradientClass: 'from-purple-50/90 via-fuchsia-50/55 to-white',
      borderClass: 'border-purple-200/80 hover:border-purple-300',
      iconBgClass: 'bg-purple-100 text-purple-700',
      codeBadgeClass: 'bg-purple-100/80 text-purple-900 border-purple-200/80',
      icon: Palette,
    };
  }
  if (haystack.includes('การงาน') || haystack.includes('อาชีพ')) {
    return {
      gradientClass: 'from-teal-50/90 via-emerald-50/45 to-white',
      borderClass: 'border-teal-200/80 hover:border-teal-300',
      iconBgClass: 'bg-teal-100 text-teal-800',
      codeBadgeClass: 'bg-teal-100/80 text-teal-900 border-teal-200/80',
      icon: Briefcase,
    };
  }

  return {
    gradientClass: 'from-slate-50 to-white',
    borderClass: 'border-slate-200 hover:border-slate-300',
    iconBgClass: 'bg-slate-100 text-slate-700',
    codeBadgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: GraduationCap,
  };
}

/**
 * Step 1 Subject Hub for ScoresPage: lets teachers pick a subject card (with code & credit)
 * before diving into score entry, gradebook (0-4), or room comparison.
 */
export function SubjectCardsHub({
  cards,
  classrooms,
  selectedClassroomId,
  onSelectClassroomFilter,
  onOpenSubject,
  onDeleteSubject,
  onQuickAddSubject,
  onLoadObecDefaults,
  onOpenAcademicSubjectsModal,
  onOpenOfficialDocuments,
  onOpenTermClosing,
  onOpenRubricModal,
  onOpenGuide,
  isLoadingSubjects = false,
  isBusy = false,
  hasOfficialSubjects,
  defaultGradeLevel,
}: SubjectCardsHubProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
  const toolsMenuRef = useRef<HTMLDivElement>(null);

  const [pendingDeleteCard, setPendingDeleteCard] = useState<SubjectCardItem | null>(null);
  const [isDeletingSubject, setIsDeletingSubject] = useState(false);

  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isSavingQuickAdd, setIsSavingQuickAdd] = useState(false);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);
  const [quickForm, setQuickForm] = useState({
    subjectName: '',
    subjectCode: '',
    learningArea: OBEC_LEARNING_AREAS[1] as string,
    gradeLevel: defaultGradeLevel || 'ป.5',
    credit: '1.0',
    hoursPerYear: '40',
    applyToAllGrades: true,
  });

  const distinctClassGrades = useMemo(() => {
    const grades = classrooms
      .map((room) => room.name.split('/')[0]?.trim())
      .filter((g): g is string => Boolean(g));
    return Array.from(new Set(grades));
  }, [classrooms]);

  useEffect(() => {
    setQuickForm((prev) => ({
      ...prev,
      gradeLevel: defaultGradeLevel || prev.gradeLevel,
    }));
  }, [defaultGradeLevel]);

  useEffect(() => {
    if (!isToolsMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (event.target instanceof Node && !toolsMenuRef.current?.contains(event.target)) {
        setIsToolsMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsToolsMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isToolsMenuOpen]);

  const filteredCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((card) =>
      [card.subjectName, card.subjectCode, ...(card.subjectCodesByGrade || []), card.learningArea]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [cards, searchQuery]);

  async function handleQuickAddSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const subjectName = quickForm.subjectName.trim();
    const subjectCode = quickForm.subjectCode.trim();
    if (!subjectName || !subjectCode) {
      setQuickAddError('กรุณากรอกทั้งชื่อวิชาและรหัสวิชา');
      return;
    }

    setQuickAddError(null);
    setIsSavingQuickAdd(true);
    try {
      const ok = await onQuickAddSubject({
        subjectName,
        subjectCode,
        learningArea: quickForm.learningArea,
        gradeLevel: quickForm.gradeLevel.trim() || defaultGradeLevel || 'ป.5',
        credit: Math.max(0.5, Number(quickForm.credit) || 1.0),
        hoursPerYear: Math.max(10, Number(quickForm.hoursPerYear) || 40),
        applyToAllGrades: quickForm.applyToAllGrades && distinctClassGrades.length > 1,
      });
      if (ok) {
        setIsQuickAddOpen(false);
        setQuickForm({
          subjectName: '',
          subjectCode: '',
          learningArea: OBEC_LEARNING_AREAS[1],
          gradeLevel: defaultGradeLevel || 'ป.5',
          credit: '1.0',
          hoursPerYear: '40',
          applyToAllGrades: true,
        });
      }
    } finally {
      setIsSavingQuickAdd(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#2F7D5B]">
            รายวิชาและผลการเรียน
          </p>
          <h1 className="mt-1 font-display text-2xl font-black tracking-tight text-[#1F2924] sm:text-3xl">
            คะแนน &amp; ตัดเกรด
          </h1>
          <p className="mt-0.5 text-xs font-semibold text-[#5C6861] sm:text-sm">
            เลือกรายวิชาเพื่อบันทึกคะแนน ตัดเกรด 0–4 และออกเอกสาร ปพ.๕ / ปพ.๖
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setQuickAddError(null);
              setIsQuickAddOpen(true);
            }}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-2xl bg-[#2F7D5B] px-4 text-xs font-black text-white shadow-sm transition hover:bg-[#246649] active:scale-[0.99]"
          >
            <Plus size={16} aria-hidden="true" />
            <span>เพิ่มรายวิชา</span>
          </button>

          <button
            type="button"
            onClick={onOpenAcademicSubjectsModal}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-2xl border border-[#DCE3D7] bg-white px-3.5 text-xs font-black text-[#1F2924] shadow-2xs transition hover:bg-[#FAFBF8]"
          >
            <BookOpen size={15} className="text-[#2F7D5B]" aria-hidden="true" />
            <span>จัดการรหัสวิชา สพฐ.</span>
          </button>

          <div className="relative" ref={toolsMenuRef}>
            <button
              type="button"
              onClick={() => setIsToolsMenuOpen((open) => !open)}
              aria-expanded={isToolsMenuOpen}
              aria-haspopup="menu"
              className={`inline-flex h-10 items-center gap-1.5 rounded-2xl border px-3.5 text-xs font-black transition ${
                isToolsMenuOpen
                  ? 'border-[#1C342B] bg-[#1C342B] text-white'
                  : 'border-[#DCE3D7] bg-white text-[#4C5751] hover:bg-[#FAFBF8]'
              }`}
            >
              <Settings2 size={15} aria-hidden="true" />
              <span>เครื่องมืออื่น</span>
              <ChevronDown
                size={14}
                className={`transition-transform ${isToolsMenuOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>

            {isToolsMenuOpen ? (
              <div
                role="menu"
                aria-label="เครื่องมือเพิ่มเติมหน้ารายวิชา"
                className="absolute right-0 top-[calc(100%+0.45rem)] z-40 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsToolsMenuOpen(false);
                    onOpenOfficialDocuments();
                  }}
                  className="flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left transition hover:bg-slate-50"
                >
                  <FileSpreadsheet size={15} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-xs font-black text-slate-900">พิมพ์ ปพ.๕ / ปพ.๖</span>
                    <span className="block text-[11px] font-medium text-slate-500">ออกเอกสารทางการและใบรับรอง</span>
                  </span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsToolsMenuOpen(false);
                    onOpenTermClosing();
                  }}
                  className="flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left transition hover:bg-slate-50"
                >
                  <Lock size={15} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-xs font-black text-slate-900">ปิดเทอม &amp; เลื่อนชั้น</span>
                    <span className="block text-[11px] font-medium text-slate-500">ตรวจความพร้อมและล็อกผลการเรียน</span>
                  </span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsToolsMenuOpen(false);
                    onOpenRubricModal();
                  }}
                  className="flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left transition hover:bg-slate-50"
                >
                  <Sparkles size={15} className="mt-0.5 shrink-0 text-violet-600" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-xs font-black text-slate-900">สร้างข้อสอบ &amp; รูบริก AI</span>
                    <span className="block text-[11px] font-medium text-slate-500">ออกแบบข้อสอบและเกณฑ์ประเมิน</span>
                  </span>
                </button>

                <Link
                  role="menuitem"
                  to="/app/dashboard?view=omr-scanner"
                  onClick={() => setIsToolsMenuOpen(false)}
                  className="flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left transition hover:bg-slate-50"
                >
                  <Camera size={15} className="mt-0.5 shrink-0 text-cyan-600" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-xs font-black text-slate-900">ตรวจกระดาษคำตอบ OMR</span>
                    <span className="block text-[11px] font-medium text-slate-500">ออกแบบและสแกนตรวจด้วยกล้อง</span>
                  </span>
                </Link>

                <Link
                  role="menuitem"
                  to="/app/dashboard?view=desirable-characteristics"
                  onClick={() => setIsToolsMenuOpen(false)}
                  className="flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left transition hover:bg-slate-50"
                >
                  <GraduationCap size={15} className="mt-0.5 shrink-0 text-indigo-600" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-xs font-black text-slate-900">ประเมินคุณลักษณะ 8 ประการ</span>
                    <span className="block text-[11px] font-medium text-slate-500">และประเมินอ่าน คิดวิเคราะห์ เขียน</span>
                  </span>
                </Link>

                <div className="my-1.5 border-t border-slate-100" />

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsToolsMenuOpen(false);
                    onOpenGuide();
                  }}
                  className="flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left transition hover:bg-slate-50"
                >
                  <BookOpen size={15} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-xs font-black text-slate-900">คู่มือการใช้งานระบบคะแนน</span>
                    <span className="block text-[11px] font-medium text-slate-500">ดูขั้นตอนการกรอกคะแนนและตัดเกรด</span>
                  </span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* 1-Click OBEC Default Subjects Banner */}
      {!hasOfficialSubjects && !isLoadingSubjects ? (
        <div className="flex flex-col gap-3 rounded-3xl border border-[#BFE0CD] bg-gradient-to-r from-[#EAF5EF] via-[#F4FAF6] to-white p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#2F7D5B] text-white shadow-xs">
              <Sparkles size={18} aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-black text-[#1C342B]">
                ยังไม่มีรหัสวิชาทางการ สพฐ. ในคลังรายวิชา
              </p>
              <p className="mt-0.5 text-xs font-semibold text-[#4C5751]">
                โหลดรายวิชาพื้นฐานครบ 8 กลุ่มสาระพร้อมรหัสวิชา ({defaultGradeLevel}) ได้ทันทีในคลิกเดียว
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => void onLoadObecDefaults()}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-2xl bg-[#1C342B] px-4 text-xs font-black text-white shadow-xs transition hover:bg-[#2F7D5B] disabled:opacity-50"
          >
            <Sparkles size={14} aria-hidden="true" />
            <span>โหลด 8 กลุ่มสาระมาตรฐาน สพฐ. พร้อมรหัสวิชา</span>
          </button>
        </div>
      ) : null}

      {/* Filter Bar: Classroom Pills + Search */}
      <div className="flex flex-col gap-3 rounded-3xl border border-[#E5E8E1] bg-white p-3.5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => onSelectClassroomFilter('all')}
            className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-black transition ${
              selectedClassroomId === 'all'
                ? 'bg-[#1C342B] text-white shadow-xs'
                : 'border border-[#DCE3D7] bg-[#FAFBF8] text-[#4C5751] hover:bg-[#EFF3EC]'
            }`}
          >
            <Users size={13} aria-hidden="true" />
            <span>ทุกห้อง</span>
          </button>

          {classrooms.map((room) => {
            const isSelected = selectedClassroomId === room.id;
            return (
              <button
                key={room.id}
                type="button"
                onClick={() => onSelectClassroomFilter(room.id)}
                className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-black transition ${
                  isSelected
                    ? 'bg-[#2F7D5B] text-white shadow-xs'
                    : 'border border-[#DCE3D7] bg-white text-[#4C5751] hover:bg-[#FAFBF8]'
                }`}
              >
                {room.isHomeroom ? <span aria-hidden="true">★</span> : null}
                <span>{room.name}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-[#F1F3EF] text-[#5C6861]'
                  }`}
                >
                  {room.studentCount}
                </span>
              </button>
            );
          })}
        </div>

        <label className="flex h-10 w-full shrink-0 items-center gap-2 rounded-2xl border border-[#DCE3D7] bg-[#FAFBF8] px-3 text-xs font-bold text-[#1F2924] focus-within:border-[#2F7D5B] focus-within:bg-white sm:w-64">
          <Search size={15} className="shrink-0 text-[#75827A]" aria-hidden="true" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="ค้นหาชื่อวิชา หรือรหัสวิชา..."
            className="w-full bg-transparent outline-none placeholder:text-[#8A958E]"
            aria-label="ค้นหารายวิชา"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="rounded-lg p-0.5 text-[#75827A] hover:bg-[#EFF1EC]"
              aria-label="ล้างคำค้นหา"
            >
              <X size={13} aria-hidden="true" />
            </button>
          ) : null}
        </label>
      </div>

      {/* Subject Cards Grid */}
      {isLoadingSubjects && cards.length === 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4].map((idx) => (
            <div
              key={idx}
              className="h-28 animate-pulse rounded-3xl border border-[#E5E8E1] bg-white/80 p-4"
            />
          ))}
        </div>
      ) : filteredCards.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filteredCards.map((card) => {
            const theme = getSubjectTheme(card.learningArea, card.subjectName);
            const Icon = theme.icon;

            return (
              <div
                key={card.key}
                role="button"
                tabIndex={0}
                onClick={() => onOpenSubject(card)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onOpenSubject(card);
                  }
                }}
                className={`group flex w-full cursor-pointer flex-col justify-between gap-3 rounded-3xl border bg-gradient-to-br p-4 text-left shadow-2xs transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F7D5B] ${theme.gradientClass} ${theme.borderClass}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl shadow-2xs ${theme.iconBgClass}`}
                    >
                      <Icon size={20} aria-hidden="true" />
                    </span>

                    <div className="min-w-0">
                      <h2 className="truncate font-display text-base font-black text-[#1F2924] group-hover:text-[#1C573D] sm:text-lg">
                        {card.subjectName}
                      </h2>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-bold">
                        {card.subjectCodesByGrade && card.subjectCodesByGrade.length > 1 ? (
                          card.subjectCodesByGrade.map((code) => (
                            <span
                              key={code}
                              className={`rounded-lg border px-2 py-0.5 font-mono text-[11px] font-black ${theme.codeBadgeClass}`}
                            >
                              {code}
                            </span>
                          ))
                        ) : card.subjectCode ? (
                          <span
                            className={`rounded-lg border px-2 py-0.5 font-mono text-[11px] font-black ${theme.codeBadgeClass}`}
                          >
                            {card.subjectCode}
                          </span>
                        ) : (
                          <span className="rounded-lg border border-dashed border-slate-300 bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                            ยังไม่ระบุรหัสวิชา
                          </span>
                        )}
                        {card.credit !== null ? (
                          <span className="text-[11px] font-bold text-[#5C6861]">
                            · {card.credit.toFixed(2)} หน่วยกิต
                          </span>
                        ) : null}
                        {card.hoursPerYear !== null ? (
                          <span className="text-[11px] font-semibold text-[#75827A]">
                            · {card.hoursPerYear} ชม.
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {onDeleteSubject ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setPendingDeleteCard(card);
                        }}
                        title={`ลบรายวิชา ${card.subjectName}`}
                        aria-label={`ลบรายวิชา ${card.subjectName}`}
                        className="grid h-8 w-8 place-items-center rounded-full bg-white/85 text-slate-400 ring-1 ring-black/5 transition hover:bg-rose-50 hover:text-rose-600 hover:ring-rose-200"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    ) : null}
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-white/85 text-[#5C6861] ring-1 ring-black/5 transition group-hover:bg-[#2F7D5B] group-hover:text-white">
                      <ChevronRight size={16} aria-hidden="true" />
                    </span>
                  </div>
                </div>

                {/* Bottom Status Strip */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-black/5 pt-2.5 text-[11px] font-bold">
                  <div className="flex flex-wrap items-center gap-1">
                    {card.classrooms.length > 0 ? (
                      <>
                        {card.classrooms.slice(0, 6).map((room) => {
                          const hasRoomCols = (room.assessmentCount || 0) > 0;
                          return (
                            <button
                              key={room.id}
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onOpenSubject(card, room.id);
                              }}
                              title={
                                hasRoomCols
                                  ? `เปิดบันทึกคะแนนวิชา ${card.subjectName} ห้อง ${room.name} (${room.assessmentCount} ช่องคะแนน)`
                                  : `เปิดวิชา ${card.subjectName} ห้อง ${room.name} เพื่อเริ่มสร้างช่องคะแนน`
                              }
                              className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 font-bold transition ${
                                hasRoomCols
                                  ? 'bg-[#1C342B] text-white shadow-2xs hover:bg-[#2F7D5B]'
                                  : 'bg-white/90 text-[#3B4740] ring-1 ring-black/10 hover:bg-[#EAF5EF] hover:text-[#1C342B] hover:ring-[#2F7D5B]/40'
                              }`}
                            >
                              <span>{room.name}</span>
                              {hasRoomCols ? (
                                <span className="rounded bg-white/20 px-1 text-[10px] font-black text-emerald-100">
                                  {room.assessmentCount} ช่อง
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                        {card.classrooms.length > 6 ? (
                          <span className="rounded-lg bg-white/70 px-1.5 py-0.5 text-[10px] font-bold text-[#5C6861]">
                            +{card.classrooms.length - 6}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-[#75827A]">พร้อมเปิดใช้งานทุกห้อง</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[#5C6861]">
                      {card.assessmentCount > 0
                        ? `${card.assessmentCount} ช่อง · ${card.plannedWeight}/100`
                        : 'ยังไม่มีช่องคะแนน'}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10.5px] font-black ${
                        card.assessmentCount === 0
                          ? 'bg-white/90 text-[#2F7D5B] ring-1 ring-[#BFE0CD]'
                          : card.completionPercent >= 100
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      {card.assessmentCount > 0
                        ? `กรอกแล้ว ${card.completionPercent}%`
                        : 'แตะเพื่อเริ่มบันทึกคะแนน'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-[#DCE3D7] bg-white px-6 py-12 text-center shadow-2xs">
          <BookOpen size={36} className="mx-auto text-[#9AA59E]" aria-hidden="true" />
          <h3 className="mt-3 text-base font-black text-[#1F2924]">
            {cards.length === 0 ? 'ยังไม่มีรายวิชาในระบบ' : `ไม่พบรายวิชา "${searchQuery}"`}
          </h3>
          <p className="mt-1 text-xs font-semibold text-[#75827A]">
            {cards.length === 0
              ? 'กด "+ เพิ่มรายวิชา" หรือโหลด 8 กลุ่มสาระมาตรฐาน สพฐ. เพื่อเริ่มต้นบันทึกคะแนน'
              : 'ลองล้างคำค้นหาหรือเปลี่ยนตัวกรองห้องเรียน'}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="h-9 rounded-xl border border-[#DCE3D7] bg-white px-4 text-xs font-bold text-[#4C5751] hover:bg-[#FAFBF8]"
              >
                แสดงทุกรายวิชา
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsQuickAddOpen(true)}
                className="inline-flex h-10 items-center gap-1.5 rounded-2xl bg-[#2F7D5B] px-4 text-xs font-black text-white shadow-xs hover:bg-[#246649]"
              >
                <Plus size={15} aria-hidden="true" />
                <span>เพิ่มรายวิชาแรก</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Quick-Add Subject Modal */}
      {isQuickAddOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-quick-add-subject-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-xs"
        >
          <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl animate-scale-up">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 pb-4 pt-5">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#EAF5EF] text-[#2F7D5B]">
                  <BookOpen size={18} aria-hidden="true" />
                </span>
                <div>
                  <h3
                    id="modal-quick-add-subject-title"
                    className="text-base font-black text-slate-900"
                  >
                    เพิ่มรายวิชาใหม่
                  </h3>
                  <p className="text-xs font-semibold text-slate-500">
                    ใส่ชื่อวิชาและรหัสวิชา เพื่อสร้างการ์ดสำหรับกรอกคะแนนทันที
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickAddOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="ปิดหน้าต่าง"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            <form
              onSubmit={(event) => void handleQuickAddSubmit(event)}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-4">
                {quickAddError ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                    {quickAddError}
                  </div>
                ) : null}

                <label className="block">
                  <span className="text-xs font-black text-slate-700">ชื่อวิชา *</span>
                  <input
                    type="text"
                    required
                    value={quickForm.subjectName}
                    onChange={(event) =>
                      setQuickForm((prev) => ({ ...prev, subjectName: event.target.value }))
                    }
                    placeholder="เช่น คณิตศาสตร์"
                    className="nexus-field mt-1.5 h-10 w-full px-3 text-xs font-bold"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-black text-slate-700">รหัสวิชา *</span>
                    <input
                      type="text"
                      required
                      value={quickForm.subjectCode}
                      onChange={(event) =>
                        setQuickForm((prev) => ({ ...prev, subjectCode: event.target.value }))
                      }
                      placeholder="เช่น ค15101"
                      className="nexus-field mt-1.5 h-10 w-full px-3 font-mono text-xs font-bold"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-black text-slate-700">ระดับชั้น</span>
                    <input
                      type="text"
                      value={quickForm.gradeLevel}
                      onChange={(event) =>
                        setQuickForm((prev) => ({ ...prev, gradeLevel: event.target.value }))
                      }
                      placeholder="เช่น ป.5"
                      className="nexus-field mt-1.5 h-10 w-full px-3 text-xs font-bold"
                    />
                  </label>
                </div>

                {distinctClassGrades.length > 1 ? (
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl border border-[#DCE3D7] bg-[#F4FAF6] p-3 text-xs font-bold text-[#1C342B]">
                    <input
                      type="checkbox"
                      checked={quickForm.applyToAllGrades}
                      onChange={(event) =>
                        setQuickForm((prev) => ({
                          ...prev,
                          applyToAllGrades: event.target.checked,
                        }))
                      }
                      className="mt-0.5 rounded text-[#2F7D5B] focus:ring-[#2F7D5B]"
                    />
                    <span className="min-w-0">
                      <span className="block font-black text-[#1C342B]">
                        สร้างให้ครบทุกชั้นที่สอน ({distinctClassGrades.join(', ')})
                      </span>
                      <span className="mt-0.5 block text-[11px] font-semibold text-[#4C5751]">
                        ระบบจะปรับรหัสวิชา สพฐ. ให้ตรงตามชั้นเรียนอัตโนมัติ (เช่น ค14101, ค15101, ค16101)
                      </span>
                    </span>
                  </label>
                ) : null}

                <label className="block">
                  <span className="text-xs font-black text-slate-700">กลุ่มสาระการเรียนรู้</span>
                  <select
                    value={quickForm.learningArea}
                    onChange={(event) =>
                      setQuickForm((prev) => ({ ...prev, learningArea: event.target.value }))
                    }
                    className="nexus-field mt-1.5 h-10 w-full px-3 text-xs font-bold"
                  >
                    {OBEC_LEARNING_AREAS.map((area) => (
                      <option key={area} value={area}>
                        {area}
                      </option>
                    ))}
                    <option value="กิจกรรมพัฒนาผู้เรียน / อื่นๆ">กิจกรรมพัฒนาผู้เรียน / อื่นๆ</option>
                  </select>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-black text-slate-700">หน่วยกิต / น้ำหนัก</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={quickForm.credit}
                      onChange={(event) =>
                        setQuickForm((prev) => ({ ...prev, credit: event.target.value }))
                      }
                      className="nexus-field mt-1.5 h-10 w-full px-3 text-xs font-bold"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-black text-slate-700">ชั่วโมง / ปี</span>
                    <input
                      type="number"
                      step="10"
                      min="10"
                      value={quickForm.hoursPerYear}
                      onChange={(event) =>
                        setQuickForm((prev) => ({ ...prev, hoursPerYear: event.target.value }))
                      }
                      className="nexus-field mt-1.5 h-10 w-full px-3 text-xs font-bold"
                    />
                  </label>
                </div>
              </div>

              <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setIsQuickAddOpen(false)}
                  className="h-10 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 hover:bg-slate-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSavingQuickAdd || isBusy}
                  className="h-10 rounded-2xl bg-[#2F7D5B] px-5 text-xs font-black text-white shadow-sm hover:bg-[#246649] disabled:opacity-50"
                >
                  {isSavingQuickAdd ? 'กำลังบันทึก...' : 'เพิ่มรายวิชาและเปิดบันทึกคะแนน'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Delete Subject Confirmation Modal */}
      {pendingDeleteCard && onDeleteSubject ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-confirm-delete-subject-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl animate-scale-up">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 pb-4 pt-5">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-rose-100 text-rose-600">
                  <Trash2 size={19} aria-hidden="true" />
                </span>
                <div>
                  <h3 id="modal-confirm-delete-subject-title" className="text-base font-black text-slate-900">
                    ยืนยันการลบรายวิชา
                  </h3>
                  <p className="text-xs font-semibold text-slate-500">
                    กรุณาตรวจสอบรายละเอียดก่อนยืนยันการลบ
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isDeletingSubject}
                onClick={() => setPendingDeleteCard(null)}
                className="grid h-8 w-8 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="ปิดหน้าต่าง"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-3.5 px-6 py-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-black text-slate-900">{pendingDeleteCard.subjectName}</span>
                  {pendingDeleteCard.subjectCode ? (
                    <span className="rounded-lg bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-bold text-white">
                      {pendingDeleteCard.subjectCode}
                    </span>
                  ) : (
                    <span className="rounded-lg border border-dashed border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                      ยังไม่ระบุรหัสวิชา
                    </span>
                  )}
                </div>
                {pendingDeleteCard.learningArea || pendingDeleteCard.credit ? (
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {pendingDeleteCard.learningArea || 'ไม่ระบุกลุ่มสาระ'}
                    {pendingDeleteCard.credit !== null ? ` · ${pendingDeleteCard.credit.toFixed(2)} หน่วยกิต` : ''}
                    {pendingDeleteCard.hoursPerYear !== null ? ` · ${pendingDeleteCard.hoursPerYear} ชม./ปี` : ''}
                  </p>
                ) : null}
              </div>

              {pendingDeleteCard.assessmentCount > 0 ? (
                <div className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50/80 p-3.5 text-xs font-bold leading-5 text-rose-800">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0 text-rose-600" aria-hidden="true" />
                  <div>
                    <p className="font-black text-rose-900">
                      วิชานี้มีช่องคะแนนอยู่ {pendingDeleteCard.assessmentCount} ช่อง (น้ำหนักรวม {pendingDeleteCard.plannedWeight} คะแนน)
                    </p>
                    <p className="mt-0.5 font-semibold text-rose-700">
                      เมื่อยืนยันลบรายวิชา ช่องคะแนนและคะแนนที่กรอกไว้ในวิชานี้จะถูกลบออกไปด้วย
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs font-bold text-emerald-800">
                  วิชานี้ยังไม่มีช่องคะแนนที่บันทึกไว้ สามารถลบออกจากรายการรายวิชาได้อย่างปลอดภัย
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-6 py-4">
              <button
                type="button"
                disabled={isDeletingSubject}
                onClick={() => setPendingDeleteCard(null)}
                className="h-10 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isDeletingSubject || isBusy}
                onClick={async () => {
                  setIsDeletingSubject(true);
                  try {
                    const ok = await onDeleteSubject(pendingDeleteCard);
                    if (ok) {
                      setPendingDeleteCard(null);
                    }
                  } finally {
                    setIsDeletingSubject(false);
                  }
                }}
                className="inline-flex h-10 items-center gap-1.5 rounded-2xl bg-rose-600 px-5 text-xs font-black text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
              >
                <Trash2 size={14} aria-hidden="true" />
                <span>{isDeletingSubject ? 'กำลังลบรายวิชา...' : 'ยืนยันลบรายวิชา'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
