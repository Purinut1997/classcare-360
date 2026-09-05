import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

type PickerMode = 'date' | 'month';

interface ThaiDatePickerProps {
  appearance?: 'adaptive' | 'light';
  className?: string;
  disabled?: boolean;
  id?: string;
  max?: string;
  min?: string;
  mode?: PickerMode;
  onValueChange: (value: string) => void;
  value: string;
}

const thaiMonths = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];
const thaiShortMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const thaiWeekdays = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function parseValue(value: string, mode: PickerMode) {
  const match = value.match(mode === 'month' ? /^(\d{4})-(\d{2})$/ : /^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = mode === 'date' ? Number(match[3]) : 1;
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  return { day, month, year };
}

function formatDisplay(value: string, mode: PickerMode) {
  const parsed = parseValue(value, mode);
  if (!parsed) return mode === 'month' ? 'เลือกเดือน' : 'เลือกวันที่';
  const buddhistYear = parsed.year + 543;
  return mode === 'month'
    ? `${thaiMonths[parsed.month]} ${buddhistYear}`
    : `${parsed.day} ${thaiMonths[parsed.month]} ${buddhistYear}`;
}

function isAllowed(value: string, min?: string, max?: string) {
  return (!min || value >= min) && (!max || value <= max);
}

export function ThaiDatePicker({
  appearance = 'adaptive',
  className = '',
  disabled = false,
  id,
  max,
  min,
  mode = 'date',
  onValueChange,
  value,
}: ThaiDatePickerProps) {
  const generatedId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = parseValue(value, mode);
  const today = new Date();
  const [isOpen, setIsOpen] = useState(false);
  const [openAbove, setOpenAbove] = useState(false);
  const [viewMonth, setViewMonth] = useState(selected?.month ?? today.getMonth());
  const [viewYear, setViewYear] = useState(selected?.year ?? today.getFullYear());
  const adaptiveSurface = appearance === 'adaptive';

  useEffect(() => {
    if (!isOpen) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [isOpen]);

  const days = useMemo(() => {
    const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
    const count = new Date(viewYear, viewMonth + 1, 0).getDate();
    return [...Array(firstWeekday).fill(null), ...Array.from({ length: count }, (_, index) => index + 1)];
  }, [viewMonth, viewYear]);

  function openPicker() {
    if (disabled) return;
    if (!isOpen && rootRef.current) {
      const rect = rootRef.current.getBoundingClientRect();
      const estimatedPickerHeight = mode === 'month' ? 250 : 360;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      setOpenAbove(spaceBelow < estimatedPickerHeight && spaceAbove > spaceBelow);
    }
    if (selected) {
      setViewMonth(selected.month);
      setViewYear(selected.year);
    }
    setIsOpen((current) => !current);
  }

  function moveMonth(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewMonth(next.getMonth());
    setViewYear(next.getFullYear());
  }

  function chooseMonth(month: number) {
    const nextValue = `${viewYear}-${pad(month + 1)}`;
    if (!isAllowed(nextValue, min, max)) return;
    onValueChange(nextValue);
    setViewMonth(month);
    setIsOpen(false);
  }

  function chooseDay(day: number) {
    const nextValue = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
    if (!isAllowed(nextValue, min, max)) return;
    onValueChange(nextValue);
    setIsOpen(false);
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={`nexus-field inline-flex w-full items-center justify-between gap-3 text-left font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
        disabled={disabled}
        id={id || generatedId}
        onClick={openPicker}
        type="button"
      >
        <span className={value ? 'font-black text-slate-900 dark:text-slate-100' : 'text-slate-400'}>
          {formatDisplay(value, mode)}
        </span>
        <CalendarDays className="shrink-0 text-cyan-700 dark:text-cyan-400" size={18} aria-hidden="true" />
      </button>

      {isOpen ? (
        <div aria-label={mode === 'month' ? 'เลือกเดือนแบบไทย' : 'เลือกวันที่แบบไทย'} className={`absolute left-0 z-[100] w-[min(21rem,calc(100vw-4rem))] rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-[0_24px_70px_rgba(2,8,23,0.22)] ${openAbove ? 'bottom-full mb-2' : 'top-full mt-2'} ${adaptiveSurface ? 'dark:border-slate-700 dark:bg-slate-900 dark:text-white' : ''}`} role="dialog">
          <div className="flex items-center justify-between gap-2">
            {mode === 'date' ? (
              <button aria-label="เดือนก่อนหน้า" className={`grid h-9 w-9 place-items-center rounded-xl hover:bg-slate-100 ${adaptiveSurface ? 'dark:hover:bg-slate-800' : ''}`} onClick={() => moveMonth(-1)} type="button"><ChevronLeft size={18} /></button>
            ) : (
              <button aria-label="ปีก่อนหน้า" className={`grid h-9 w-9 place-items-center rounded-xl hover:bg-slate-100 ${adaptiveSurface ? 'dark:hover:bg-slate-800' : ''}`} onClick={() => setViewYear((year) => year - 1)} type="button"><ChevronLeft size={18} /></button>
            )}
            <p className="text-sm font-black">{mode === 'date' ? `${thaiMonths[viewMonth]} ${viewYear + 543}` : `พ.ศ. ${viewYear + 543}`}</p>
            {mode === 'date' ? (
              <button aria-label="เดือนถัดไป" className={`grid h-9 w-9 place-items-center rounded-xl hover:bg-slate-100 ${adaptiveSurface ? 'dark:hover:bg-slate-800' : ''}`} onClick={() => moveMonth(1)} type="button"><ChevronRight size={18} /></button>
            ) : (
              <button aria-label="ปีถัดไป" className={`grid h-9 w-9 place-items-center rounded-xl hover:bg-slate-100 ${adaptiveSurface ? 'dark:hover:bg-slate-800' : ''}`} onClick={() => setViewYear((year) => year + 1)} type="button"><ChevronRight size={18} /></button>
            )}
          </div>

          {mode === 'month' ? (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {thaiShortMonths.map((label, month) => {
                const optionValue = `${viewYear}-${pad(month + 1)}`;
                const active = selected?.year === viewYear && selected.month === month;
                return <button className={`rounded-xl px-2 py-3 text-sm font-bold transition ${active ? 'bg-cyan-700 text-white' : `bg-slate-50 hover:bg-cyan-50 hover:text-cyan-800 ${adaptiveSurface ? 'dark:bg-slate-800 dark:hover:bg-slate-700' : ''}`} disabled:opacity-30`} disabled={!isAllowed(optionValue, min, max)} key={label} onClick={() => chooseMonth(month)} type="button">{label}</button>;
              })}
            </div>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-7 text-center text-[11px] font-bold text-slate-500">
                {thaiWeekdays.map((weekday) => <span className="py-2" key={weekday}>{weekday}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {days.map((day, index) => {
                  if (!day) return <span key={`blank-${index}`} />;
                  const optionValue = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
                  const active = value === optionValue;
                  const isToday = today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day;
                  return <button aria-label={`${day} ${thaiMonths[viewMonth]} ${viewYear + 543}`} className={`grid aspect-square place-items-center rounded-lg text-sm font-bold transition ${active ? 'bg-cyan-700 text-white' : isToday ? 'bg-cyan-50 text-cyan-800 ring-1 ring-cyan-200' : `hover:bg-slate-100 ${adaptiveSurface ? 'dark:hover:bg-slate-800' : ''}`} disabled:opacity-25`} disabled={!isAllowed(optionValue, min, max)} key={day} onClick={() => chooseDay(day)} type="button">{day}</button>;
                })}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
