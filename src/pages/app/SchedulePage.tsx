import { Fragment, useMemo, useState } from 'react';
import {
  BookOpenCheck,
  CalendarRange,
  Clock3,
  Download,
  FileSpreadsheet,
  GraduationCap,
  Printer,
  Save,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import type { AppSessionContext } from '../../types/core';

interface SchedulePageProps {
  session: AppSessionContext;
}

type ScheduleMode = 'teacher' | 'classroom';

interface PeriodSlot {
  end: string;
  index: number;
  label: string;
  start: string;
}

const dayOptions = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสฯ', 'ศุกร์'];
const subjectOptions = ['คณิตศาสตร์', 'ภาษาไทย', 'วิทยาศาสตร์', 'สังคมศึกษา', 'ภาษาอังกฤษ', 'ศิลปะ', 'สุขศึกษา', 'โฮมรูม'];

function toMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function toTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function buildPeriods({
  lunchEnd,
  lunchStart,
  periodCount,
  periodMinutes,
  startTime,
}: {
  lunchEnd: string;
  lunchStart: string;
  periodCount: number;
  periodMinutes: number;
  startTime: string;
}) {
  const slots: PeriodSlot[] = [];
  let cursor = toMinutes(startTime);
  const lunchStartMinutes = toMinutes(lunchStart);
  const lunchEndMinutes = toMinutes(lunchEnd);

  for (let index = 1; index <= periodCount; index += 1) {
    if (cursor >= lunchStartMinutes && cursor < lunchEndMinutes) {
      cursor = lunchEndMinutes;
    }

    const end = cursor + periodMinutes;
    slots.push({
      end: toTime(end),
      index,
      label: `คาบ ${index}`,
      start: toTime(cursor),
    });
    cursor = end;
  }

  return slots;
}

function makeCellKey(day: string, periodIndex: number) {
  return `${day}-${periodIndex}`;
}

export function SchedulePage({ session }: SchedulePageProps) {
  const [mode, setMode] = useState<ScheduleMode>('teacher');
  const [periodCount, setPeriodCount] = useState(9);
  const [periodMinutes, setPeriodMinutes] = useState(50);
  const [startTime, setStartTime] = useState('08:20');
  const [lunchStart, setLunchStart] = useState('11:40');
  const [lunchEnd, setLunchEnd] = useState('12:30');
  const [activeDays, setActiveDays] = useState(dayOptions);
  const [selectedSubject, setSelectedSubject] = useState(subjectOptions[0]);
  const [selectedClassroom, setSelectedClassroom] = useState(session.workspace?.classroomName || 'ป.5/1');
  const [cells, setCells] = useState<Record<string, { classroom: string; subject: string }>>({
    [makeCellKey('จันทร์', 1)]: { classroom: 'ป.5/1', subject: 'โฮมรูม' },
    [makeCellKey('จันทร์', 2)]: { classroom: 'ป.5/1', subject: 'คณิตศาสตร์' },
    [makeCellKey('อังคาร', 3)]: { classroom: 'ป.5/1', subject: 'ภาษาไทย' },
  });

  const periods = useMemo(
    () =>
      buildPeriods({
        lunchEnd,
        lunchStart,
        periodCount,
        periodMinutes,
        startTime,
      }),
    [lunchEnd, lunchStart, periodCount, periodMinutes, startTime],
  );

  const usedCells = Object.keys(cells).length;
  const totalCells = activeDays.length * periods.length;
  const completion = totalCells > 0 ? Math.round((usedCells / totalCells) * 100) : 0;

  function toggleDay(day: string) {
    setActiveDays((current) =>
      current.includes(day) ? current.filter((item) => item !== day) : dayOptions.filter((item) => [...current, day].includes(item)),
    );
  }

  function assignCell(day: string, periodIndex: number) {
    const key = makeCellKey(day, periodIndex);
    setCells((current) => ({
      ...current,
      [key]: { classroom: selectedClassroom, subject: selectedSubject },
    }));
  }

  function clearCell(day: string, periodIndex: number) {
    const key = makeCellKey(day, periodIndex);
    setCells((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function exportCsv() {
    const rows = [['day', 'period', 'start', 'end', 'subject', 'classroom']];
    for (const day of activeDays) {
      for (const period of periods) {
        const cell = cells[makeCellKey(day, period.index)];
        rows.push([day, period.label, period.start, period.end, cell?.subject || '', cell?.classroom || '']);
      }
    }

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'classcare-schedule.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="app-page">
      <div className="app-page-header">
        <div>
          <div className="nexus-kicker">
            <CalendarRange size={18} aria-hidden="true" />
            Teaching Schedule
          </div>
          <h1 className="app-page-title">จัดตารางสอนและตารางเรียน</h1>
          <p className="app-page-description">
            กำหนดวันเรียน จำนวนคาบ นาทีต่อคาบ และพักเที่ยง แล้วใช้ตารางนี้เป็นฐานสำหรับเช็คเวลาเรียนรายวิชา คะแนน และรายงานโรงเรียน
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:min-w-[420px]">
          {[
            { label: 'คาบ/วัน', value: periodCount },
            { label: 'นาที/คาบ', value: periodMinutes },
            { label: 'กรอกแล้ว', value: `${completion}%` },
          ].map((metric) => (
            <div className="rounded-2xl bg-white p-3 text-center font-black text-slate-950 shadow-[0_12px_28px_rgba(15,23,42,0.06)] ring-1 ring-[#ead8bd]" key={metric.label}>
              <p className="text-2xl">{metric.value}</p>
              <p className="mt-1 text-xs text-slate-500">{metric.label}</p>
            </div>
          ))}
        </div>
      </div>

      <section className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="grid gap-5">
          <section className="app-panel-pad">
            <div className="nexus-kicker">
              <Clock3 size={16} aria-hidden="true" />
              ตั้งค่าเวลาเรียน
            </div>
            <div className="mt-4 grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  จำนวนคาบ
                  <input className="nexus-field h-11 px-3" min={1} max={12} onChange={(event) => setPeriodCount(Number(event.target.value))} type="number" value={periodCount} />
                </label>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  นาทีต่อคาบ
                  <input className="nexus-field h-11 px-3" min={20} max={90} onChange={(event) => setPeriodMinutes(Number(event.target.value))} type="number" value={periodMinutes} />
                </label>
              </div>
              <label className="grid gap-2 text-sm font-black text-slate-700">
                เวลาเริ่มเรียน
                <input className="nexus-field h-11 px-3" onChange={(event) => setStartTime(event.target.value)} type="time" value={startTime} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  เริ่มพักเที่ยง
                  <input className="nexus-field h-11 px-3" onChange={(event) => setLunchStart(event.target.value)} type="time" value={lunchStart} />
                </label>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  จบพักเที่ยง
                  <input className="nexus-field h-11 px-3" onChange={(event) => setLunchEnd(event.target.value)} type="time" value={lunchEnd} />
                </label>
              </div>
              <div>
                <p className="text-sm font-black text-slate-700">วันเรียน</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {dayOptions.map((day) => {
                    const isActive = activeDays.includes(day);
                    return (
                      <button
                        className={`h-10 rounded-2xl text-xs font-black ring-1 transition hover:-translate-y-0.5 ${
                          isActive ? 'bg-[#4b2f18] text-white ring-[#4b2f18]' : 'bg-white text-slate-500 ring-slate-200'
                        }`}
                        key={day}
                        onClick={() => toggleDay(day)}
                        type="button"
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className="app-panel-pad">
            <div className="nexus-kicker">
              <BookOpenCheck size={16} aria-hidden="true" />
              วิชาและห้องที่จะใส่ตาราง
            </div>
            <div className="mt-4 grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <button
                  className={`h-11 rounded-2xl text-sm font-black ring-1 transition ${mode === 'teacher' ? 'bg-slate-950 text-white ring-slate-950' : 'bg-white text-slate-600 ring-slate-200'}`}
                  onClick={() => setMode('teacher')}
                  type="button"
                >
                  ตารางสอนครู
                </button>
                <button
                  className={`h-11 rounded-2xl text-sm font-black ring-1 transition ${mode === 'classroom' ? 'bg-slate-950 text-white ring-slate-950' : 'bg-white text-slate-600 ring-slate-200'}`}
                  onClick={() => setMode('classroom')}
                  type="button"
                >
                  ตารางเรียนห้อง
                </button>
              </div>
              <label className="grid gap-2 text-sm font-black text-slate-700">
                วิชา
                <select className="nexus-field h-11 px-3" onChange={(event) => setSelectedSubject(event.target.value)} value={selectedSubject}>
                  {subjectOptions.map((subject) => (
                    <option key={subject} value={subject}>{subject}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-black text-slate-700">
                ห้องเรียน
                <input className="nexus-field h-11 px-3" onChange={(event) => setSelectedClassroom(event.target.value)} value={selectedClassroom} />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button className="amber-action inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black" type="button">
                  <Save size={17} aria-hidden="true" />
                  บันทึกแบบร่าง
                </button>
                <button className="dark-action inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black" onClick={exportCsv} type="button">
                  <Download size={17} aria-hidden="true" />
                  CSV
                </button>
              </div>
            </div>
          </section>
        </div>

        <section className="app-panel-pad overflow-hidden">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-black text-[#b46a00]">{mode === 'teacher' ? 'ตารางสอนครู' : 'ตารางเรียนห้อง'}</p>
              <h2 className="text-3xl font-black text-slate-950">{session.workspace?.schoolName || 'โรงเรียนตัวอย่าง ClassCare'}</h2>
              <p className="mt-1 text-sm font-bold text-slate-500">คลิกช่องในตารางเพื่อใส่วิชา/ห้องที่เลือก คลิกช่องที่มีข้อมูลเพื่อล้าง</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="nexus-pill inline-flex h-11 items-center justify-center gap-2 px-4 text-sm font-black text-slate-700" onClick={() => window.print()} type="button">
                <Printer size={17} aria-hidden="true" />
                พิมพ์
              </button>
              <Link className="nexus-pill inline-flex h-11 items-center justify-center gap-2 px-4 text-sm font-black text-slate-700" to="/app/dashboard?view=reports&reportView=attendance">
                <FileSpreadsheet size={17} aria-hidden="true" />
                รายงานเวลาเรียน
              </Link>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <div className="min-w-[980px] rounded-[2rem] border border-[#e3b875] bg-[#fff7df] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.55)]">
              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: `110px repeat(${periods.length}, minmax(90px, 1fr))` }}
              >
                <div className="grid min-h-20 place-items-center rounded-2xl bg-[#dfae6d] p-2 text-center text-lg font-black text-white">
                  วัน/เวลา
                </div>
                {periods.map((period) => (
                  <div className="grid min-h-20 place-items-center rounded-2xl bg-[#dfae6d] p-2 text-center font-black text-white" key={period.index}>
                    <span>{period.label}</span>
                    <span className="text-xs leading-5">{period.start}<br />{period.end}</span>
                  </div>
                ))}

                {activeDays.map((day) => (
                  <Fragment key={day}>
                    <div className="grid min-h-20 place-items-center rounded-2xl bg-[#dfae6d] p-2 text-xl font-black text-white">
                      {day}
                    </div>
                    {periods.map((period) => {
                      const key = makeCellKey(day, period.index);
                      const cell = cells[key];
                      const isLunchGap = toMinutes(period.start) >= toMinutes(lunchStart) && toMinutes(period.start) < toMinutes(lunchEnd);

                      return (
                        <button
                          className={`min-h-20 rounded-2xl border p-2 text-left transition hover:-translate-y-0.5 ${
                            cell
                              ? 'border-[#4b2f18] bg-[#4b2f18] text-white shadow-[0_14px_26px_rgba(75,47,24,0.20)]'
                              : isLunchGap
                                ? 'border-amber-200 bg-amber-100/70 text-amber-900'
                                : 'border-[#e7c997] bg-white/95 text-slate-400 hover:border-[#d99b40]'
                          }`}
                          key={key}
                          onClick={() => (cell ? clearCell(day, period.index) : assignCell(day, period.index))}
                          type="button"
                        >
                          {cell ? (
                            <>
                              <p className="text-sm font-black">{cell.subject}</p>
                              <p className="mt-1 text-xs font-bold opacity-80">{cell.classroom}</p>
                            </>
                          ) : (
                            <span className="grid h-full place-items-center text-center text-xs font-black">
                              {isLunchGap ? 'พัก / กิจกรรม' : 'เพิ่ม'}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {[
              { body: 'เมื่อเลือกคาบจากตาราง ระบบควรส่งค่า ห้อง วิชา วันที่ คาบ ไปหน้าเช็คเวลาเรียนรายวิชา', label: 'เชื่อมเวลาเรียน', to: '/app/dashboard?view=teacher-work' },
              { body: 'รายวิชาและห้องจากตารางใช้ตั้งต้นชุดคะแนน ลดการเลือกซ้ำของครูประจำวิชา', label: 'เชื่อมคะแนน', to: '/app/dashboard?view=scores&scoreView=setup' },
              { body: 'Export ตารางเรียนรายห้อง ตารางสอนรายครู และรายงานคาบเรียนเป็น CSV/PDF ได้', label: 'เชื่อมรายงาน', to: '/app/dashboard?view=reports&reportView=settings' },
            ].map((item) => (
              <Link className="rounded-3xl border border-[#ead8bd] bg-white/88 p-4 transition hover:-translate-y-0.5 hover:border-amber-300" key={item.label} to={item.to}>
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#fff1c9] text-[#8a5200]">
                    <GraduationCap size={18} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-black text-slate-950">{item.label}</p>
                    <p className="mt-1 text-xs font-bold leading-5 text-slate-500">{item.body}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
