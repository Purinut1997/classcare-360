import { Fragment, type ChangeEvent, useMemo, useState } from 'react';
import {
  BookOpenCheck,
  CalendarRange,
  Clock3,
  Download,
  FileSpreadsheet,
  ImagePlus,
  Printer,
  Save,
  Settings2,
  UserRound,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import {
  buildSchedulePeriods,
  compressImageFile,
  defaultDays,
  exportScheduleCsv,
  loadScheduleSettings,
  loadSchoolReportIdentity,
  makeScheduleCellKey,
  saveScheduleSettings,
  saveSchoolReportIdentity,
  type DayName,
  type ScheduleCell,
  type SchoolReportIdentity,
} from '../../lib/scheduleSettings';
import type { AppSessionContext } from '../../types/core';

interface SchedulePageProps {
  session: AppSessionContext;
}

export function SchedulePage({ session }: SchedulePageProps) {
  const [settings, setSettings] = useState(() => loadScheduleSettings(session.workspace?.classroomName || 'ป.5/1'));
  const [identity, setIdentity] = useState<SchoolReportIdentity>(() => ({
    ...loadSchoolReportIdentity(),
    academicYear: session.workspace?.academicYear || loadSchoolReportIdentity().academicYear,
    classroomName: session.workspace?.classroomName || loadSchoolReportIdentity().classroomName,
    schoolName: session.workspace?.schoolName || loadSchoolReportIdentity().schoolName,
  }));
  const [selectedSubject, setSelectedSubject] = useState(settings.subjectOptions[0] || 'คณิตศาสตร์');
  const [selectedSubjectCode, setSelectedSubjectCode] = useState('ค15101');
  const [selectedClassroom, setSelectedClassroom] = useState(session.workspace?.classroomName || settings.classroomOptions[0] || 'ป.5/1');
  const [notice, setNotice] = useState<string | null>(null);

  const periods = useMemo(() => buildSchedulePeriods(settings), [settings]);
  const usedCells = Object.keys(settings.cells).length;
  const totalCells = settings.activeDays.length * periods.length;
  const completion = totalCells > 0 ? Math.round((usedCells / totalCells) * 100) : 0;

  function updateSettings(next: Partial<typeof settings>) {
    setSettings((current) => ({ ...current, ...next }));
  }

  function toggleDay(day: DayName) {
    const nextDays = settings.activeDays.includes(day)
      ? settings.activeDays.filter((item) => item !== day)
      : defaultDays.filter((item) => [...settings.activeDays, day].includes(item));

    updateSettings({ activeDays: nextDays.length ? nextDays : [day] });
  }

  function saveAll(nextSettings = settings, nextIdentity = identity) {
    const subjectOptions = Array.from(
      new Set([
        ...nextSettings.subjectOptions,
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
    const normalizedSettings = { ...nextSettings, classroomOptions, subjectOptions };

    setSettings(normalizedSettings);
    saveScheduleSettings(normalizedSettings);
    saveSchoolReportIdentity(nextIdentity);
    setNotice('บันทึกตั้งค่าตารางสอนแล้ว หน้าเช็คเวลาเรียนจะเห็นคาบและรายวิชาจากตารางนี้');
  }

  function assignCell(day: DayName, periodIndex: number) {
    const key = makeScheduleCellKey(day, periodIndex);
    const current = settings.cells[key];

    if (current) {
      const nextCells = { ...settings.cells };
      delete nextCells[key];
      const nextSettings = { ...settings, cells: nextCells };
      setSettings(nextSettings);
      saveScheduleSettings(nextSettings);
      return;
    }

    const nextCell: ScheduleCell = {
      classroom: selectedClassroom.trim() || identity.classroomName,
      subject: selectedSubject.trim() || 'ไม่ระบุวิชา',
      subjectCode: selectedSubjectCode.trim() || undefined,
    };
    const nextSettings = {
      ...settings,
      cells: {
        ...settings.cells,
        [key]: nextCell,
      },
    };
    saveAll(nextSettings);
  }

  async function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const schoolLogoDataUrl = await compressImageFile(file, 520, 0.78);
      const nextIdentity = { ...identity, schoolLogoDataUrl };
      setIdentity(nextIdentity);
      saveSchoolReportIdentity(nextIdentity);
      setNotice('บีบอัดและบันทึกโลโก้โรงเรียนสำหรับรายงานแล้ว');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'อัปโหลดโลโก้ไม่สำเร็จ');
    }
  }

  function printSchedule() {
    saveAll();
    window.print();
  }

  return (
    <main className="app-page">
      <style>{`
        @media print {
          body { background: #fff !important; }
          .app-sidebar, .app-shell-sidebar, .app-topbar, .print-hidden, .no-print { display: none !important; }
          .app-page { padding: 0 !important; background: #fff !important; }
          .schedule-print-sheet { display: block !important; }
          .schedule-screen { display: none !important; }
        }
      `}</style>

      <section className="schedule-print-sheet hidden bg-white p-8 text-black">
        <div className="relative min-h-[980px]">
          {identity.schoolLogoDataUrl ? (
            <img alt="school logo" className="absolute left-0 top-0 h-28 w-28 object-contain" src={identity.schoolLogoDataUrl} />
          ) : null}
          <div className="mx-auto max-w-[920px] text-center">
            <h1 className="text-2xl font-bold">{identity.schoolName}</h1>
            <p className="mt-3 text-xl font-bold">{settings.courseTitle || 'ตารางสอนประจำสัปดาห์'} ปีการศึกษา {identity.academicYear}</p>
            <p className="mt-3 text-xl font-bold">ครูผู้สอน {identity.teacherName || '................................................'}</p>
          </div>

          <table className="mt-10 w-full border-collapse text-center text-[15px]">
            <thead>
              <tr>
                <th className="w-28 border border-black p-2">วัน / เวลา</th>
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
                      <td className="h-24 border border-black p-2 align-middle" key={period.index}>
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

          <div className="mt-14 grid grid-cols-3 gap-8 text-center text-lg">
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

        <section className="grid gap-5 xl:grid-cols-[440px_minmax(0,1fr)]">
          <div className="grid gap-5">
            <section className="app-panel-pad">
              <div className="nexus-kicker">
                <Settings2 size={16} aria-hidden="true" />
                ตั้งค่าตารางและรายงาน
              </div>
              <div className="mt-4 grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-2 text-sm font-black text-slate-700">
                    จำนวนคาบ
                    <input className="nexus-field h-11 px-3" min={1} max={12} onChange={(event) => updateSettings({ periodCount: Number(event.target.value) })} type="number" value={settings.periodCount} />
                  </label>
                  <label className="grid gap-2 text-sm font-black text-slate-700">
                    นาทีต่อคาบ
                    <input className="nexus-field h-11 px-3" min={20} max={90} onChange={(event) => updateSettings({ periodMinutes: Number(event.target.value) })} type="number" value={settings.periodMinutes} />
                  </label>
                </div>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  เวลาเริ่มเรียน
                  <input className="nexus-field h-11 px-3" onChange={(event) => updateSettings({ startTime: event.target.value })} type="time" value={settings.startTime} />
                </label>
                <div className="grid grid-cols-2 gap-3">
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
              </div>
            </section>

            <section className="app-panel-pad">
              <div className="nexus-kicker">
                <ImagePlus size={16} aria-hidden="true" />
                ตั้งค่าโรงเรียนและผู้ลงนาม
              </div>
              <div className="mt-4 grid gap-3">
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  โลโก้โรงเรียน
                  <input className="nexus-field h-11 px-3 py-2" accept="image/*" onChange={(event) => void handleLogoChange(event)} type="file" />
                </label>
                {identity.schoolLogoDataUrl ? (
                  <img alt="โลโก้โรงเรียน" className="h-20 w-20 rounded-2xl border border-[#ead8bd] bg-white object-contain p-2" src={identity.schoolLogoDataUrl} />
                ) : null}
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  ชื่อโรงเรียน
                  <input className="nexus-field h-11 px-3" onChange={(event) => setIdentity((current) => ({ ...current, schoolName: event.target.value }))} value={identity.schoolName} />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-2 text-sm font-black text-slate-700">
                    ปีการศึกษา
                    <input className="nexus-field h-11 px-3" onChange={(event) => setIdentity((current) => ({ ...current, academicYear: event.target.value }))} value={identity.academicYear} />
                  </label>
                  <label className="grid gap-2 text-sm font-black text-slate-700">
                    ห้องหลัก
                    <input className="nexus-field h-11 px-3" onChange={(event) => setIdentity((current) => ({ ...current, classroomName: event.target.value }))} value={identity.classroomName} />
                  </label>
                </div>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  ชื่อครูผู้สอน
                  <input className="nexus-field h-11 px-3" onChange={(event) => setIdentity((current) => ({ ...current, teacherName: event.target.value }))} value={identity.teacherName} />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-2 text-sm font-black text-slate-700">
                    หัวหน้าวิชาการ
                    <input className="nexus-field h-11 px-3" onChange={(event) => setIdentity((current) => ({ ...current, academicHeadName: event.target.value }))} value={identity.academicHeadName} />
                  </label>
                  <label className="grid gap-2 text-sm font-black text-slate-700">
                    ผู้อำนวยการโรงเรียน
                    <input className="nexus-field h-11 px-3" onChange={(event) => setIdentity((current) => ({ ...current, directorName: event.target.value }))} value={identity.directorName} />
                  </label>
                </div>
              </div>
            </section>

            <section className="app-panel-pad">
              <div className="nexus-kicker">
                <BookOpenCheck size={16} aria-hidden="true" />
                รายวิชาและห้อง
              </div>
              <div className="mt-4 grid gap-3">
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  รหัสวิชา
                  <input className="nexus-field h-11 px-3" onChange={(event) => setSelectedSubjectCode(event.target.value)} placeholder="เช่น อ14101" value={selectedSubjectCode} />
                </label>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  รายวิชา
                  <input className="nexus-field h-11 px-3" list="schedule-subject-options" onChange={(event) => setSelectedSubject(event.target.value)} value={selectedSubject} />
                  <datalist id="schedule-subject-options">
                    {settings.subjectOptions.map((subject) => (
                      <option key={subject} value={subject} />
                    ))}
                  </datalist>
                </label>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  ห้องเรียน
                  <input className="nexus-field h-11 px-3" list="schedule-classroom-options" onChange={(event) => setSelectedClassroom(event.target.value)} value={selectedClassroom} />
                  <datalist id="schedule-classroom-options">
                    {settings.classroomOptions.map((classroom) => (
                      <option key={classroom} value={classroom} />
                    ))}
                  </datalist>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button className="amber-action inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black" onClick={() => saveAll()} type="button">
                    <Save size={17} aria-hidden="true" />
                    บันทึก
                  </button>
                  <button className="dark-action inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black" onClick={() => exportScheduleCsv(settings)} type="button">
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
                <p className="text-sm font-black text-[#b46a00]">ตารางสำหรับใช้งานจริง</p>
                <h2 className="text-3xl font-black text-slate-950">{identity.schoolName}</h2>
                <p className="mt-1 text-sm font-bold text-slate-500">คลิกช่องเพื่อใส่วิชา/ห้อง คลิกช่องเดิมอีกครั้งเพื่อล้าง</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="nexus-pill inline-flex h-11 items-center justify-center gap-2 px-4 text-sm font-black text-slate-700" onClick={printSchedule} type="button">
                  <Printer size={17} aria-hidden="true" />
                  พิมพ์ตาราง
                </button>
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
                            onClick={() => assignCell(day, period.index)}
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
        </section>
      </div>
    </main>
  );
}
