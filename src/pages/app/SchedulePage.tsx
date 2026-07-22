import { Fragment, useMemo, useState } from 'react';
import {
  BookOpenCheck,
  CalendarRange,
  Download,
  FileSpreadsheet,
  Plus,
  Printer,
  Save,
  Settings2,
  Trash2,
  UserRound,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

import {
  buildSchedulePeriods,
  defaultDays,
  exportScheduleCsv,
  loadScheduleSettings,
  loadSchoolReportIdentity,
  makeScheduleCellKey,
  saveScheduleSettings,
  type DayName,
  type ScheduleCell,
  type ScheduleSubjectOption,
  type SchoolReportIdentity,
} from '../../lib/scheduleSettings';
import type { AppSessionContext } from '../../types/core';

interface SchedulePageProps {
  session: AppSessionContext;
}

export function SchedulePage({ session }: SchedulePageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [settings, setSettings] = useState(() => loadScheduleSettings(session.workspace?.classroomName || 'ป.5/1'));
  const firstSubject = settings.subjects[0];
  const [identity] = useState<SchoolReportIdentity>(() => ({
    ...loadSchoolReportIdentity(),
    academicYear: session.workspace?.academicYear || loadSchoolReportIdentity().academicYear,
    classroomName: session.workspace?.classroomName || loadSchoolReportIdentity().classroomName,
    schoolName: session.workspace?.schoolName || loadSchoolReportIdentity().schoolName,
  }));
  const [selectedSubject, setSelectedSubject] = useState(firstSubject?.name || settings.subjectOptions[0] || 'คณิตศาสตร์');
  const [selectedSubjectCode, setSelectedSubjectCode] = useState(firstSubject?.code || 'ค15101');
  const [selectedClassroom, setSelectedClassroom] = useState(session.workspace?.classroomName || settings.classroomOptions[0] || 'ป.5/1');
  const [subjectDraft, setSubjectDraft] = useState<ScheduleSubjectOption>(() => ({
    code: firstSubject?.code || 'ค15101',
    name: firstSubject?.name || settings.subjectOptions[0] || 'คณิตศาสตร์',
    teacherName: firstSubject?.teacherName || '',
  }));
  const [editingCell, setEditingCell] = useState<{ day: DayName; periodIndex: number } | null>(null);
  const [cellDraft, setCellDraft] = useState<ScheduleCell>(() => ({
    classroom: session.workspace?.classroomName || settings.classroomOptions[0] || 'ป.5/1',
    subject: firstSubject?.name || settings.subjectOptions[0] || 'คณิตศาสตร์',
    subjectCode: firstSubject?.code || 'ค15101',
  }));
  const [notice, setNotice] = useState<string | null>(null);

  const activeView = searchParams.get('scheduleView') === 'settings' ? 'settings' : 'table';
  const periods = useMemo(() => buildSchedulePeriods(settings), [settings]);
  const usedCells = Object.keys(settings.cells).length;
  const totalCells = settings.activeDays.length * periods.length;
  const completion = totalCells > 0 ? Math.round((usedCells / totalCells) * 100) : 0;

  function updateSettings(next: Partial<typeof settings>) {
    setSettings((current) => ({ ...current, ...next }));
  }

  function setScheduleView(nextView: 'table' | 'settings') {
    const next = new URLSearchParams(searchParams);
    next.set('view', 'schedule');
    next.set('scheduleView', nextView);
    setSearchParams(next);
  }

  function toggleDay(day: DayName) {
    const nextDays = settings.activeDays.includes(day)
      ? settings.activeDays.filter((item) => item !== day)
      : defaultDays.filter((item) => [...settings.activeDays, day].includes(item));

    updateSettings({ activeDays: nextDays.length ? nextDays : [day] });
  }

  function saveAll(nextSettings = settings) {
    const subjects = normalizeSubjects([
      ...nextSettings.subjects,
      { code: selectedSubjectCode.trim(), name: selectedSubject.trim() },
      ...Object.values(nextSettings.cells).map((cell) => ({
        code: cell.subjectCode || '',
        name: cell.subject,
      })),
    ]);
    const subjectOptions = Array.from(
      new Set([
        ...nextSettings.subjectOptions,
        ...subjects.map((subject) => subject.name),
        selectedSubject.trim(),
        ...Object.values(nextSettings.cells).map((cell) => cell.subject),
      ].filter(Boolean)),
    );
    const classroomOptions = Array.from(
      new Set([
        ...nextSettings.classroomOptions,
        selectedClassroom.trim(),
        ...Object.values(nextSettings.cells).map((cell) => cell.classroom),
      ].filter(Boolean)),
    );
    const normalizedSettings = { ...nextSettings, classroomOptions, subjects, subjectOptions };

    setSettings(normalizedSettings);
    saveScheduleSettings(normalizedSettings);
    setNotice('บันทึกตั้งค่าตารางสอนแล้ว หน้าเช็คเวลาเรียนจะเห็นคาบและรายวิชาจากตารางนี้');
  }

  function normalizeSubjects(subjects: ScheduleSubjectOption[]) {
    const subjectMap = new Map<string, ScheduleSubjectOption>();
    subjects.forEach((subject) => {
      const name = subject.name.trim();
      if (!name) return;
      const existing = subjectMap.get(name);
      subjectMap.set(name, {
        code: subject.code.trim() || existing?.code || '',
        name,
        teacherName: subject.teacherName?.trim() || existing?.teacherName || '',
      });
    });
    return Array.from(subjectMap.values());
  }

  function addSubject() {
    const name = subjectDraft.name.trim();
    if (!name) {
      setNotice('กรุณากรอกชื่อรายวิชาก่อนบันทึก');
      return;
    }

    const subjects = normalizeSubjects([...settings.subjects, { ...subjectDraft, name }]);
    const nextSettings = {
      ...settings,
      subjects,
      subjectOptions: Array.from(new Set([...settings.subjectOptions, ...subjects.map((subject) => subject.name)])),
    };
    setSelectedSubject(name);
    setSelectedSubjectCode(subjectDraft.code.trim());
    setSettings(nextSettings);
    saveScheduleSettings(nextSettings);
    setNotice(`เพิ่มรายวิชา ${name} แล้ว`);
  }

  function savePeriodSettings() {
    saveAll(settings);
    setNotice('บันทึกตั้งค่าคาบเรียนและวันเรียนแล้ว');
  }

  function saveSubjectSettings() {
    const subjects = normalizeSubjects(settings.subjects);
    const nextSettings = {
      ...settings,
      subjects,
      subjectOptions: subjects.map((subject) => subject.name),
    };
    setSettings(nextSettings);
    saveScheduleSettings(nextSettings);
    setNotice('บันทึกรายวิชาที่ใช้ใน dropdown แล้ว');
  }

  function saveClassroomSettings() {
    const classroom = selectedClassroom.trim();
    const classroomOptions = classroom
      ? Array.from(new Set([...settings.classroomOptions, classroom]))
      : settings.classroomOptions;
    const nextSettings = { ...settings, classroomOptions };
    setSettings(nextSettings);
    saveScheduleSettings(nextSettings);
    setNotice('บันทึกห้องเรียนที่ใช้ในตารางแล้ว');
  }

  function removeSubject(subjectName: string) {
    const subjects = settings.subjects.filter((subject) => subject.name !== subjectName);
    const subjectOptions = settings.subjectOptions.filter((name) => name !== subjectName);
    const nextSettings = { ...settings, subjects, subjectOptions };
    setSettings(nextSettings);
    saveScheduleSettings(nextSettings);
    setNotice(`ลบรายวิชา ${subjectName} ออกจาก dropdown แล้ว ตารางที่เคยกรอกไว้ยังคงข้อมูลเดิมเพื่อไม่ทำรายงานหาย`);
  }

  function updateCellDraftSubject(nextSubjectName: string) {
    const match = settings.subjects.find((subject) => subject.name === nextSubjectName);
    setCellDraft((current) => ({
      ...current,
      subject: nextSubjectName,
      subjectCode: match?.code || current.subjectCode || '',
    }));
  }

  function openCellEditor(day: DayName, periodIndex: number) {
    const key = makeScheduleCellKey(day, periodIndex);
    const current = settings.cells[key];
    const fallbackCell: ScheduleCell = {
      classroom: selectedClassroom.trim() || identity.classroomName,
      subject: selectedSubject.trim() || 'ไม่ระบุวิชา',
      subjectCode: selectedSubjectCode.trim() || undefined,
    };
    setCellDraft(current || fallbackCell);
    setEditingCell({ day, periodIndex });
  }

  function saveEditingCell() {
    if (!editingCell) return;

    const subject = cellDraft.subject.trim();
    if (!subject) {
      setNotice('กรุณาเลือกรายวิชาก่อนบันทึกช่องตาราง');
      return;
    }

    const key = makeScheduleCellKey(editingCell.day, editingCell.periodIndex);
    const nextCell: ScheduleCell = {
      classroom: cellDraft.classroom.trim() || selectedClassroom.trim() || identity.classroomName,
      subject,
      subjectCode: cellDraft.subjectCode?.trim() || undefined,
    };
    const nextSettings = {
      ...settings,
      cells: {
        ...settings.cells,
        [key]: nextCell,
      },
    };
    saveAll(nextSettings);
    setSelectedSubject(nextCell.subject);
    setSelectedSubjectCode(nextCell.subjectCode || '');
    setSelectedClassroom(nextCell.classroom);
    setEditingCell(null);
    setNotice(`บันทึก ${nextCell.subject} ใน ${editingCell.day} คาบ ${editingCell.periodIndex} แล้ว`);
  }

  function clearEditingCell() {
    if (!editingCell) return;

    const key = makeScheduleCellKey(editingCell.day, editingCell.periodIndex);
    const nextCells = { ...settings.cells };
    delete nextCells[key];
    const nextSettings = { ...settings, cells: nextCells };
    setSettings(nextSettings);
    saveScheduleSettings(nextSettings);
    setEditingCell(null);
    setNotice(`ล้างช่อง ${editingCell.day} คาบ ${editingCell.periodIndex} แล้ว`);
  }

  function printSchedule() {
    saveAll();
    window.print();
  }

  return (
    <main className="app-page">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          body { background: #fff !important; }
          .app-sidebar, .app-shell-sidebar, .app-topbar, .print-hidden, .no-print { display: none !important; }
          .app-page { padding: 0 !important; background: #fff !important; }
          .schedule-print-sheet { display: block !important; width: 281mm !important; min-height: 194mm !important; padding: 0 !important; }
          .schedule-screen { display: none !important; }
          .schedule-print-table { font-size: 10.5px !important; table-layout: fixed !important; }
          .schedule-print-table th, .schedule-print-table td { padding: 4px !important; }
          .schedule-print-day { width: 24mm !important; }
          .schedule-print-cell { height: 18mm !important; }
        }
      `}</style>

      <section className="schedule-print-sheet hidden bg-white p-8 text-black">
        <div className="relative min-h-[194mm]">
          {identity.schoolLogoDataUrl ? (
            <img alt="school logo" className="absolute left-0 top-0 h-20 w-20 object-contain" src={identity.schoolLogoDataUrl} />
          ) : null}
          <div className="mx-auto max-w-[920px] text-center">
            <h1 className="text-xl font-bold">{identity.schoolName}</h1>
            <p className="mt-2 text-lg font-bold">{settings.courseTitle || 'ตารางสอนประจำสัปดาห์'} ปีการศึกษา {identity.academicYear}</p>
            <p className="mt-2 text-lg font-bold">ครูผู้สอน {identity.teacherName || '................................................'}</p>
          </div>

          <table className="schedule-print-table mt-7 w-full border-collapse text-center text-[12px]">
            <thead>
              <tr>
                <th className="schedule-print-day w-24 border border-black p-2">วัน / เวลา</th>
                {periods.map((period) => (
                  <th className="border border-black p-2" key={period.index}>
                    ชั่วโมงที่ {period.index}
                    <br />
                    <span className="font-normal">{period.start}-{period.end} น.</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {settings.activeDays.map((day) => (
                <tr key={day}>
                  <th className="border border-black p-2 text-lg">{day}</th>
                  {periods.map((period) => {
                    const cell = settings.cells[makeScheduleCellKey(day, period.index)];
                    return (
                      <td className="schedule-print-cell h-20 border border-black p-2 align-middle" key={period.index}>
                        {cell ? (
                          <>
                            <div>{cell.subjectCode || ''}</div>
                            <div className="mt-2">{cell.subject}</div>
                            <div className="mt-1 text-sm">{cell.classroom}</div>
                          </>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-9 grid grid-cols-3 gap-8 text-center text-base">
            <div>
              <p>ลงชื่อ........................................ครูผู้สอน</p>
              <p className="mt-3">({identity.teacherName || '........................................'})</p>
            </div>
            <div>
              <p>ลงชื่อ........................................หัวหน้าวิชาการ</p>
              <p className="mt-3">({identity.academicHeadName || '........................................'})</p>
            </div>
            <div>
              <p>ลงชื่อ........................................ผู้อำนวยการโรงเรียน</p>
              <p className="mt-3">({identity.directorName || '........................................'})</p>
            </div>
          </div>
        </div>
      </section>

      <div className="schedule-screen">
        <div className="app-page-header">
          <div>
            <div className="nexus-kicker">
              <CalendarRange size={18} aria-hidden="true" />
              Teaching Schedule
            </div>
            <h1 className="app-page-title">จัดตารางสอนและตารางเรียน</h1>
            <p className="app-page-description">
              ตั้งค่าวันเรียน คาบเรียน วิชา ห้อง และข้อมูลรายงาน จุดนี้จะกลายเป็น dropdown ให้บันทึกเวลาเรียนและรายงานใช้ต่อ
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:min-w-[420px]">
            {[
              { label: 'คาบ/วัน', value: settings.periodCount },
              { label: 'วันเปิดใช้', value: settings.activeDays.length },
              { label: 'กรอกแล้ว', value: `${completion}%` },
            ].map((metric) => (
              <div className="rounded-2xl bg-white p-3 text-center font-black text-slate-950 shadow-[0_12px_28px_rgba(15,23,42,0.06)] ring-1 ring-[#ead8bd]" key={metric.label}>
                <p className="text-2xl">{metric.value}</p>
                <p className="mt-1 text-xs text-slate-500">{metric.label}</p>
              </div>
            ))}
          </div>
        </div>

        {notice ? (
          <div className="mb-5 rounded-2xl border border-cyan-100 bg-cyan-50 p-3 text-sm font-bold text-cyan-900">
            {notice}
          </div>
        ) : null}

        <section className="mb-5 rounded-[1.75rem] border border-[#ead8bd] bg-white/92 p-2 shadow-[0_14px_34px_rgba(122,79,38,0.06)]">
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { value: 'table' as const, label: 'ตาราง', description: 'กรอกช่องตารางสอนและพิมพ์เอกสาร' },
              { value: 'settings' as const, label: 'ตั้งค่า', description: 'คาบเรียน รายวิชา และห้องที่ใช้ในตาราง' },
            ].map((item) => (
              <button
                className={`rounded-[1.35rem] px-4 py-3 text-left transition ${
                  activeView === item.value
                    ? 'bg-[#fff1c9] text-[#4b2f18] ring-1 ring-[#e6bd70]'
                    : 'text-slate-600 hover:bg-[#fffaf0]'
                }`}
                key={item.value}
                onClick={() => setScheduleView(item.value)}
                type="button"
              >
                <span className="text-base font-black">{item.label}</span>
                <span className="mt-1 block text-xs font-bold">{item.description}</span>
              </button>
            ))}
          </div>
        </section>

        {activeView === 'settings' ? (
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <section className="app-panel-pad">
              <div className="nexus-kicker">
                <Settings2 size={16} aria-hidden="true" />
                ตั้งค่าคาบเรียน
              </div>
              <div className="mt-4 grid gap-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-black text-slate-700">
                    จำนวนคาบ
                    <input className="nexus-field h-11 px-3" min={1} max={12} onChange={(event) => updateSettings({ periodCount: Number(event.target.value) })} type="number" value={settings.periodCount} />
                  </label>
                  <label className="grid gap-2 text-sm font-black text-slate-700">
                    นาทีต่อคาบ
                    <input className="nexus-field h-11 px-3" min={20} max={90} onChange={(event) => updateSettings({ periodMinutes: Number(event.target.value) })} type="number" value={settings.periodMinutes} />
                  </label>
                  <label className="grid gap-2 text-sm font-black text-slate-700 sm:col-span-2">
                    เวลาเริ่มเรียน
                    <input className="nexus-field h-11 px-3" onChange={(event) => updateSettings({ startTime: event.target.value })} type="time" value={settings.startTime} />
                  </label>
                  <label className="grid gap-2 text-sm font-black text-slate-700">
                    เริ่มพักเที่ยง
                    <input className="nexus-field h-11 px-3" onChange={(event) => updateSettings({ lunchStart: event.target.value })} type="time" value={settings.lunchStart} />
                  </label>
                  <label className="grid gap-2 text-sm font-black text-slate-700">
                    จบพักเที่ยง
                    <input className="nexus-field h-11 px-3" onChange={(event) => updateSettings({ lunchEnd: event.target.value })} type="time" value={settings.lunchEnd} />
                  </label>
                </div>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  ชื่อรายงาน / รายวิชาเอกสาร
                  <input className="nexus-field h-11 px-3" onChange={(event) => updateSettings({ courseTitle: event.target.value })} value={settings.courseTitle} />
                </label>
                <div>
                  <p className="text-sm font-black text-slate-700">วันเรียน</p>
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {defaultDays.map((day) => {
                      const isActive = settings.activeDays.includes(day);
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
                <button className="amber-action inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black" onClick={savePeriodSettings} type="button">
                  <Save size={17} aria-hidden="true" />
                  บันทึกตั้งค่าคาบเรียน
                </button>
              </div>
            </section>

            <section className="app-panel-pad">
              <div className="nexus-kicker">
                <BookOpenCheck size={16} aria-hidden="true" />
                ตั้งค่ารายวิชาที่สอน
              </div>
              <div className="mt-4 grid gap-3">
                <div className="grid gap-3 md:grid-cols-[160px_minmax(0,1fr)]">
                  <label className="grid gap-2 text-sm font-black text-slate-700">
                    รหัสวิชา
                    <input className="nexus-field h-11 px-3" onChange={(event) => setSubjectDraft((current) => ({ ...current, code: event.target.value }))} placeholder="เช่น ค15101" value={subjectDraft.code} />
                  </label>
                  <label className="grid gap-2 text-sm font-black text-slate-700">
                    ชื่อรายวิชา
                    <input className="nexus-field h-11 px-3" onChange={(event) => setSubjectDraft((current) => ({ ...current, name: event.target.value }))} placeholder="เช่น คณิตศาสตร์" value={subjectDraft.name} />
                  </label>
                </div>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  ครูผู้สอนรายวิชา
                  <input className="nexus-field h-11 px-3" onChange={(event) => setSubjectDraft((current) => ({ ...current, teacherName: event.target.value }))} placeholder="เว้นว่างได้ ถ้าใช้ครูผู้สอนหลัก" value={subjectDraft.teacherName || ''} />
                </label>
                <button className="amber-action inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black" onClick={addSubject} type="button">
                  <Plus size={17} aria-hidden="true" />
                  เพิ่มรายวิชาใน dropdown
                </button>
                <div className="mt-2 grid gap-2">
                  {settings.subjects.map((subject) => (
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#ead8bd] bg-[#fffaf0] p-3" key={subject.name}>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-950">{subject.name}</p>
                        <p className="text-xs font-bold text-slate-500">{subject.code || 'ยังไม่กรอกรหัส'}{subject.teacherName ? ` | ${subject.teacherName}` : ''}</p>
                      </div>
                      <button className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-200" onClick={() => removeSubject(subject.name)} title="ลบรายวิชาออกจาก dropdown" type="button">
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
                <button className="nexus-pill inline-flex h-11 items-center justify-center gap-2 px-4 text-sm font-black text-slate-700" onClick={saveSubjectSettings} type="button">
                  <Save size={17} aria-hidden="true" />
                  บันทึกรายวิชาทั้งหมด
                </button>
              </div>
            </section>

            <section className="app-panel-pad">
              <div className="nexus-kicker">
                <FileSpreadsheet size={16} aria-hidden="true" />
                ห้องเรียนและส่งออก
              </div>
              <div className="mt-4 grid gap-3">
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  ห้องเรียนที่ใช้ในตาราง
                  <input className="nexus-field h-11 px-3" list="schedule-classroom-options" onChange={(event) => setSelectedClassroom(event.target.value)} value={selectedClassroom} />
                  <datalist id="schedule-classroom-options">
                    {settings.classroomOptions.map((classroom) => (
                      <option key={classroom} value={classroom} />
                    ))}
                  </datalist>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button className="amber-action inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black" onClick={saveClassroomSettings} type="button">
                    <Save size={17} aria-hidden="true" />
                    บันทึกห้องเรียน
                  </button>
                  <button className="dark-action inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black" onClick={() => exportScheduleCsv(settings)} type="button">
                    <Download size={17} aria-hidden="true" />
                    CSV
                  </button>
                </div>
              </div>
            </section>
          </section>
        ) : (
          <section className="app-panel-pad overflow-hidden">
            <div className="mb-5 grid gap-3 rounded-[1.75rem] border border-[#ead8bd] bg-[#fffaf0]/80 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b46a00]">วิชาหลักที่เลือกไว้</p>
                <h3 className="mt-1 text-2xl font-black text-slate-950">
                  {selectedSubjectCode ? `${selectedSubjectCode} / ` : ''}{selectedSubject || 'ยังไม่ได้เลือกวิชา'}
                </h3>
                <p className="mt-1 text-sm font-bold text-slate-500">คลิกช่องตารางเพื่อเพิ่มหรือแก้ไข ระบบจะให้เลือกวิชาและห้องในกล่องเดียว ไม่ต้องจำปุ่มหลายขั้น</p>
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                <button className="nexus-pill inline-flex h-11 items-center justify-center gap-2 px-4 text-sm font-black text-slate-700" onClick={() => setScheduleView('settings')} type="button">
                  <Settings2 size={17} aria-hidden="true" />
                  ตั้งค่า
                </button>
                <button className="amber-action inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black" onClick={() => saveAll()} type="button">
                  <Save size={17} aria-hidden="true" />
                  บันทึกตาราง
                </button>
                <button className="nexus-pill inline-flex h-11 items-center justify-center gap-2 px-4 text-sm font-black text-slate-700" onClick={printSchedule} type="button">
                  <Printer size={17} aria-hidden="true" />
                  พิมพ์ A4 แนวนอน
                </button>
              </div>
            </div>

            {editingCell ? (
              <div className="mb-5 rounded-[1.75rem] border border-[#d99b40] bg-white p-4 shadow-[0_18px_44px_rgba(122,79,38,0.12)]">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                  <div className="min-w-[180px]">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b46a00]">กำลังแก้ไข</p>
                    <h3 className="mt-1 text-2xl font-black text-slate-950">
                      {editingCell.day} / คาบ {editingCell.periodIndex}
                    </h3>
                  </div>
                  <label className="grid flex-1 gap-2 text-sm font-black text-slate-700">
                    รายวิชา
                    <select className="nexus-field h-11 px-3" onChange={(event) => updateCellDraftSubject(event.target.value)} value={cellDraft.subject}>
                      {settings.subjects.map((subject) => (
                        <option key={subject.name} value={subject.name}>
                          {subject.code ? `${subject.code} - ${subject.name}` : subject.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid min-w-[150px] gap-2 text-sm font-black text-slate-700">
                    รหัสวิชา
                    <input className="nexus-field h-11 px-3" onChange={(event) => setCellDraft((current) => ({ ...current, subjectCode: event.target.value }))} placeholder="เช่น ค15101" value={cellDraft.subjectCode || ''} />
                  </label>
                  <label className="grid min-w-[170px] gap-2 text-sm font-black text-slate-700">
                    ห้องเรียน
                    <select className="nexus-field h-11 px-3" onChange={(event) => setCellDraft((current) => ({ ...current, classroom: event.target.value }))} value={cellDraft.classroom}>
                      {settings.classroomOptions.map((classroom) => (
                        <option key={classroom} value={classroom}>
                          {classroom}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid grid-cols-3 gap-2 lg:w-[330px]">
                    <button className="amber-action inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black" onClick={saveEditingCell} type="button">
                      <Save size={16} aria-hidden="true" />
                      บันทึก
                    </button>
                    <button className="nexus-pill inline-flex h-11 items-center justify-center gap-2 px-4 text-sm font-black text-rose-600 ring-rose-200" onClick={clearEditingCell} type="button">
                      <Trash2 size={16} aria-hidden="true" />
                      ล้าง
                    </button>
                    <button className="nexus-pill inline-flex h-11 items-center justify-center px-4 text-sm font-black text-slate-600" onClick={() => setEditingCell(null)} type="button">
                      ยกเลิก
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mb-5 rounded-[1.75rem] border border-[#ead8bd] bg-white/90 p-4">
              <div className="grid gap-3 rounded-3xl border border-[#e6bd70] bg-[#fffaf0] p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b46a00]">วิธีใช้งานตาราง</p>
                  <h3 className="mt-1 text-2xl font-black text-slate-950">คลิกช่องว่างหรือช่องที่มีวิชาแล้วแก้ได้ทันที</h3>
                  <p className="mt-1 text-sm font-bold text-slate-500">ข้อมูลรายวิชาและห้องเรียนมาจากเมนูตั้งค่า ส่วนปุ่มพิมพ์จะจัดหน้าเป็น A4 แนวนอนอัตโนมัติ</p>
                </div>
                <div className="rounded-2xl bg-[#4b2f18] px-4 py-3 text-sm font-black text-white">
                  {usedCells}/{totalCells} ช่อง
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-black text-[#b46a00]">ตารางสำหรับใช้งานจริง</p>
                <h2 className="text-3xl font-black text-slate-950">{identity.schoolName}</h2>
                <p className="mt-1 text-sm font-bold text-slate-500">คลิกช่องเพื่อใส่ แก้ไข หรือล้างวิชาในคาบนั้น</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link className="nexus-pill inline-flex h-11 items-center justify-center gap-2 px-4 text-sm font-black text-slate-700" to="/app/dashboard?view=reports&reportView=attendance">
                  <FileSpreadsheet size={17} aria-hidden="true" />
                  รายงานเวลาเรียน
                </Link>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto">
              <div className="min-w-[980px] rounded-[2rem] border border-[#e3b875] bg-[#fff7df] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.55)]">
                <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-white/80 p-3">
                  <div className="flex items-center gap-3">
                    {identity.schoolLogoDataUrl ? <img alt="โลโก้โรงเรียน" className="h-12 w-12 rounded-xl object-contain" src={identity.schoolLogoDataUrl} /> : null}
                    <div>
                      <p className="font-black text-slate-950">{settings.courseTitle}</p>
                      <p className="text-xs font-bold text-slate-500">{identity.teacherName || 'ยังไม่กรอกครูผู้สอน'} | ปีการศึกษา {identity.academicYear}</p>
                    </div>
                  </div>
                  <div className="nexus-pill inline-flex items-center gap-2 px-3 py-2 text-xs font-black text-slate-600">
                    <UserRound size={15} aria-hidden="true" />
                    {selectedSubjectCode || 'รหัสวิชา'} / {selectedSubject}
                  </div>
                </div>

                <div className="grid gap-2" style={{ gridTemplateColumns: `110px repeat(${periods.length}, minmax(96px, 1fr))` }}>
                  <div className="grid min-h-20 place-items-center rounded-2xl bg-[#dfae6d] p-2 text-center text-lg font-black text-white">
                    วัน/เวลา
                  </div>
                  {periods.map((period) => (
                    <div className="grid min-h-20 place-items-center rounded-2xl bg-[#dfae6d] p-2 text-center font-black text-white" key={period.index}>
                      <span>{period.label}</span>
                      <span className="text-xs leading-5">{period.start}<br />{period.end}</span>
                    </div>
                  ))}

                  {settings.activeDays.map((day) => (
                    <Fragment key={day}>
                      <div className="grid min-h-20 place-items-center rounded-2xl bg-[#dfae6d] p-2 text-lg font-black text-white">
                        {day}
                      </div>
                      {periods.map((period) => {
                        const key = makeScheduleCellKey(day, period.index);
                        const cell = settings.cells[key];

                        return (
                          <button
                            className={`min-h-20 rounded-2xl border p-2 text-left transition hover:-translate-y-0.5 ${
                              cell
                                ? 'border-[#4b2f18] bg-[#4b2f18] text-white shadow-[0_14px_26px_rgba(75,47,24,0.20)]'
                                : 'border-[#e7c997] bg-white/95 text-slate-400 hover:border-[#d99b40]'
                            }`}
                            key={key}
                            onClick={() => openCellEditor(day, period.index)}
                            type="button"
                          >
                            {cell ? (
                              <>
                                <p className="text-xs font-black opacity-80">{cell.subjectCode || '-'}</p>
                                <p className="mt-1 text-sm font-black">{cell.subject}</p>
                                <p className="mt-1 text-xs font-bold opacity-80">{cell.classroom}</p>
                              </>
                            ) : (
                              <span className="grid h-full place-items-center text-center text-xs font-black">เพิ่ม</span>
                            )}
                          </button>
                        );
                      })}
                    </Fragment>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
