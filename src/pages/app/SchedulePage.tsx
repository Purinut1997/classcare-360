import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  BookOpenCheck,
  CalendarRange,
  Download,
  FileSpreadsheet,
  Plus,
  Printer,
  Save,
  Settings2,
  Sparkles,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { ContextLink as Link } from '../../components/navigation/ContextLink';
import { ScheduleOcrModal } from '../../components/schedule/ScheduleOcrModal';
import type { ParsedScheduleResult } from '../../lib/aiVisionService';

import { getBangkokDate } from '../../lib/date';
import { buildOfficialDocumentCode, formatThaiOfficialDate, escapeOfficialHtml } from '../../lib/officialReport';
import {
  buildSchedulePeriods,
  defaultDays,
  exportScheduleCsv,
  loadScheduleSettings,
  loadSchoolReportIdentity,
  makeScheduleCellKey,
  saveScheduleSettings,
  saveSchoolReportIdentity,
  type DayName,
  type ScheduleCell,
  type SchedulePeriod,
  type ScheduleSubjectOption,
  type SchoolReportIdentity,
} from '../../lib/scheduleSettings';
import { supabase } from '../../lib/supabaseClient';
import type { AppSessionContext } from '../../types/core';

interface SchedulePageProps {
  session: AppSessionContext;
}

type ScheduleColumn =
  | { period: SchedulePeriod; type: 'period' }
  | { end: string; key: 'lunch'; start: string; type: 'lunch' };

interface WorkspaceClassroomRow {
  academic_year: string | null;
  id: string;
  name: string;
  status: string | null;
}

function toScheduleMinutes(time: string) {
  const [hours, minutes] = time.split(':').map((value) => Number(value));
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
}

function formatScheduleClassroom(classroom?: string) {
  return classroom?.trim() || '';
}

async function makeDarkLogoBackgroundTransparent(source: string) {
  if (!source || typeof document === 'undefined') return source;

  return new Promise<string>((resolve) => {
    const image = new Image();
    image.onload = () => {
      try {
        const longestEdge = Math.max(image.naturalWidth, image.naturalHeight);
        const scale = longestEdge > 420 ? 420 / longestEdge : 1;
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return resolve(source);

        context.drawImage(image, 0, 0, width, height);
        const pixels = context.getImageData(0, 0, width, height);
        for (let index = 0; index < pixels.data.length; index += 4) {
          const [red, green, blue] = [pixels.data[index], pixels.data[index + 1], pixels.data[index + 2]];
          if (red < 28 && green < 28 && blue < 28) pixels.data[index + 3] = 0;
        }
        context.putImageData(pixels, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(source);
      }
    };
    image.onerror = () => resolve(source);
    image.src = source;
  });
}

export function SchedulePage({ session }: SchedulePageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const workspaceId = session.workspace?.id;
  const [settings, setSettings] = useState(() => loadScheduleSettings(session.workspace?.classroomName || 'ป.5/1', workspaceId));
  const firstSubject = settings.subjects[0];
  const [identity, setIdentity] = useState<SchoolReportIdentity>(() => ({
    ...loadSchoolReportIdentity(workspaceId),
    academicYear: session.workspace?.academicYear || loadSchoolReportIdentity(workspaceId).academicYear,
    classroomName: session.workspace?.classroomName || loadSchoolReportIdentity(workspaceId).classroomName,
    schoolName: session.workspace?.schoolName || loadSchoolReportIdentity(workspaceId).schoolName,
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
  const [quickSubjectName, setQuickSubjectName] = useState('');
  const [workspaceClassrooms, setWorkspaceClassrooms] = useState<WorkspaceClassroomRow[]>([]);
  const [printLogoDataUrl, setPrintLogoDataUrl] = useState('');
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadSharedSchedule() {
      if (!supabase || !session.workspace) return;
      const { data, error } = await supabase
        .from('workspace_schedule_settings')
        .select('settings')
        .eq('workspace_id', session.workspace.id)
        .maybeSingle();

      if (!isMounted || error || !data?.settings || typeof data.settings !== 'object') return;
      const shared = data.settings as typeof settings;
      const merged = { ...loadScheduleSettings(session.workspace.classroomName || 'ป.5/1', session.workspace.id), ...shared };
      setSettings(merged);
      setSelectedSubject(merged.subjects[0]?.name || merged.subjectOptions[0] || 'คณิตศาสตร์');
      setSelectedSubjectCode(merged.subjects[0]?.code || '');
      setNotice('โหลดรายวิชาและตารางสอนกลางของ workspace แล้ว');
    }

    void loadSharedSchedule();
    return () => { isMounted = false; };
  }, [session.workspace]);

  useEffect(() => {
    let isMounted = true;
    void makeDarkLogoBackgroundTransparent(identity.schoolLogoDataUrl).then((nextLogo) => {
      if (isMounted) setPrintLogoDataUrl(nextLogo);
    });
    return () => { isMounted = false; };
  }, [identity.schoolLogoDataUrl]);

  useEffect(() => {
    let isMounted = true;

    async function loadWorkspaceClassrooms() {
      if (!supabase || !session.workspace) return;
      const { data, error } = await supabase
        .from('classrooms')
        .select('id,name,academic_year,status')
        .eq('workspace_id', session.workspace.id)
        .eq('status', 'active')
        .order('name', { ascending: true });

      if (!isMounted || error) return;
      setWorkspaceClassrooms((data || []) as WorkspaceClassroomRow[]);
    }

    void loadWorkspaceClassrooms();
    return () => { isMounted = false; };
  }, [session.workspace]);

  useEffect(() => {
    let isMounted = true;
    async function loadWorkspaceIdentity() {
      if (!supabase || !session.workspace) return;
      const workspace = session.workspace;
      const { data, error } = await supabase
        .from('workspaces')
        .select('school_name,academic_year,settings')
        .eq('id', workspace.id)
        .maybeSingle();
      if (!isMounted || error || !data) return;
      const workspaceSettings = (data.settings || {}) as { classroom_name?: string; report_identity?: Partial<SchoolReportIdentity> };
      setIdentity((current) => ({
        ...current,
        ...(workspaceSettings.report_identity || {}),
        academicYear: data.academic_year || workspace.academicYear,
        classroomName: workspaceSettings.classroom_name || workspace.classroomName,
        schoolName: data.school_name || workspace.schoolName,
      }));
    }
    void loadWorkspaceIdentity();
    return () => { isMounted = false; };
  }, [session.workspace]);

  function persistSharedSchedule(nextSettings: typeof settings) {
    if (!supabase || !session.workspace) return;
    void supabase
      .from('workspace_schedule_settings')
      .upsert({ settings: nextSettings, updated_by: session.profile.id, workspace_id: session.workspace.id })
      .then(({ error }) => {
        if (error) setNotice('บันทึกไว้ในเครื่องแล้ว แต่ยัง sync ตารางกลางไม่ได้: ตรวจ migration 0028 และสิทธิ์ owner');
      });
  }

  const activeView = searchParams.get('scheduleView') === 'settings' ? 'settings' : 'table';
  const periods = useMemo(() => buildSchedulePeriods(settings), [settings]);
  const scheduleColumns = useMemo<ScheduleColumn[]>(() => {
    const lunchStartMinutes = toScheduleMinutes(settings.lunchStart);
    const lunchEndMinutes = toScheduleMinutes(settings.lunchEnd);
    const hasLunchBreak = lunchEndMinutes > lunchStartMinutes;
    const hasMorningPeriod = periods.some((period) => toScheduleMinutes(period.end) <= lunchStartMinutes);
    const columns: ScheduleColumn[] = [];
    let lunchInserted = false;

    periods.forEach((period) => {
      if (hasLunchBreak && hasMorningPeriod && !lunchInserted && toScheduleMinutes(period.start) >= lunchEndMinutes) {
        columns.push({
          end: settings.lunchEnd,
          key: 'lunch',
          start: settings.lunchStart,
          type: 'lunch',
        });
        lunchInserted = true;
      }

      columns.push({ period, type: 'period' });
    });

    return columns;
  }, [periods, settings.lunchEnd, settings.lunchStart]);
  const usedCells = Object.keys(settings.cells).length;
  const totalCells = settings.activeDays.length * periods.length;
  const completion = totalCells > 0 ? Math.round((usedCells / totalCells) * 100) : 0;
  const editingPeriod = editingCell ? periods.find((period) => period.index === editingCell.periodIndex) : null;

  const workloadSummary = useMemo(() => {
    const map = new Map<string, { code: string; name: string; classrooms: Set<string>; count: number }>();
    for (const day of settings.activeDays) {
      for (const period of periods) {
        const cell = settings.cells[makeScheduleCellKey(day, period.index)];
        if (!cell || !cell.subject.trim()) continue;
        const key = `${cell.subjectCode || ''}___${cell.subject.trim()}`;
        const existing = map.get(key);
        const room = cell.classroom || identity.classroomName || '';
        if (existing) {
          existing.count += 1;
          if (room) existing.classrooms.add(room);
        } else {
          map.set(key, {
            code: cell.subjectCode || '',
            name: cell.subject.trim(),
            classrooms: new Set(room ? [room] : []),
            count: 1,
          });
        }
      }
    }
    const items = Array.from(map.values()).sort((a, b) => b.count - a.count);
    const totalPeriods = items.reduce((acc, it) => acc + it.count, 0);
    const totalHours = Math.round(((totalPeriods * settings.periodMinutes) / 60) * 10) / 10;
    return { items, totalPeriods, totalHours };
  }, [settings, periods, identity.classroomName]);

  const scheduleClassroomOptions = useMemo(() => {
    const options = new Map<string, { label: string; value: string }>();
    workspaceClassrooms.forEach((classroom) => {
      options.set(classroom.name, {
        label: `${classroom.name}${classroom.academic_year ? ` (${classroom.academic_year})` : ''}`,
        value: classroom.name,
      });
    });
    settings.classroomOptions.forEach((classroom) => {
      if (!options.has(classroom)) options.set(classroom, { label: classroom, value: classroom });
    });
    if (cellDraft.classroom && !options.has(cellDraft.classroom)) {
      options.set(cellDraft.classroom, { label: cellDraft.classroom, value: cellDraft.classroom });
    }
    return Array.from(options.values());
  }, [cellDraft.classroom, settings.classroomOptions, workspaceClassrooms]);

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
    saveScheduleSettings(normalizedSettings, workspaceId);
    persistSharedSchedule(normalizedSettings);
    setNotice('บันทึกตั้งค่าตารางสอนแล้ว หน้าเช็คเวลาเรียนจะเห็นคาบและรายวิชาจากตารางนี้');
  }

  function handleApplySchedule(result: ParsedScheduleResult, mode: 'replace' | 'merge') {
    const baseCells = mode === 'replace' ? {} : { ...settings.cells };
    const nextCells: Record<string, ScheduleCell> = { ...baseCells };

    result.cells.forEach((c) => {
      const key = makeScheduleCellKey(c.day, c.periodIndex);
      nextCells[key] = {
        classroom: c.classroom?.trim() || selectedClassroom || session.workspace?.classroomName || 'ป.5/1',
        subject: c.subjectName.trim(),
        subjectCode: c.subjectCode?.trim() || undefined,
      };
    });

    const newSubjectsMap = new Map<string, ScheduleSubjectOption>();
    settings.subjects.forEach((s) => newSubjectsMap.set(s.name, s));
    result.subjects.forEach((s) => {
      if (s.name) {
        newSubjectsMap.set(s.name, {
          code: s.code?.trim() || '',
          name: s.name.trim(),
          teacherName: s.teacherName?.trim() || '',
        });
      }
    });

    const subjects = Array.from(newSubjectsMap.values());
    const subjectOptions = Array.from(new Set([...settings.subjectOptions, ...subjects.map((s) => s.name)]));

    const nextSettings: typeof settings = {
      ...settings,
      cells: nextCells,
      subjects,
      subjectOptions,
      courseTitle: result.courseTitle?.trim() || settings.courseTitle,
      periodCount: result.periodCount || settings.periodCount,
      periodMinutes: result.periodMinutes || settings.periodMinutes,
      startTime: result.startTime?.trim() || settings.startTime,
      lunchStart: result.lunchStart?.trim() || settings.lunchStart,
      lunchEnd: result.lunchEnd?.trim() || settings.lunchEnd,
    };

    if (result.teacherName?.trim()) {
      const nextIdentity = { ...identity, teacherName: result.teacherName.trim() };
      setIdentity(nextIdentity);
      saveSchoolReportIdentity(nextIdentity, workspaceId);
    }

    saveAll(nextSettings);
    setNotice(`นำเข้าตารางสอนจากภาพถ่ายสำเร็จ! ตรวจพบ ${result.cells.length} คาบ (${result.subjects.length} รายวิชา)`);
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
    saveScheduleSettings(nextSettings, workspaceId);
    persistSharedSchedule(nextSettings);
    setNotice(`เพิ่มรายวิชา ${name} แล้ว`);
  }

  function addQuickSubject() {
    const name = quickSubjectName.trim();
    if (!name) return;
    const subjects = normalizeSubjects([...settings.subjects, { code: '', name }]);
    const nextSettings = { ...settings, subjects, subjectOptions: Array.from(new Set([...settings.subjectOptions, name])) };
    setSettings(nextSettings);
    saveScheduleSettings(nextSettings, workspaceId);
    persistSharedSchedule(nextSettings);
    setSelectedSubject(name);
    setSelectedSubjectCode('');
    setCellDraft((current) => ({ ...current, subject: name, subjectCode: '' }));
    setQuickSubjectName('');
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
    saveScheduleSettings(nextSettings, workspaceId);
    persistSharedSchedule(nextSettings);
    setNotice('บันทึกรายวิชาที่ใช้ใน dropdown แล้ว');
  }

  function saveClassroomSettings() {
    const classroom = selectedClassroom.trim();
    const classroomOptions = classroom
      ? Array.from(new Set([...settings.classroomOptions, classroom]))
      : settings.classroomOptions;
    const nextSettings = { ...settings, classroomOptions };
    setSettings(nextSettings);
    saveScheduleSettings(nextSettings, workspaceId);
    persistSharedSchedule(nextSettings);
    setNotice('บันทึกห้องเรียนที่ใช้ในตารางแล้ว');
  }

  function removeSubject(subjectName: string) {
    const subjects = settings.subjects.filter((subject) => subject.name !== subjectName);
    const subjectOptions = settings.subjectOptions.filter((name) => name !== subjectName);
    const nextSettings = { ...settings, subjects, subjectOptions };
    setSettings(nextSettings);
    saveScheduleSettings(nextSettings, workspaceId);
    persistSharedSchedule(nextSettings);
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
      classroom: cellDraft.classroom.trim(),
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
    saveScheduleSettings(nextSettings, workspaceId);
    persistSharedSchedule(nextSettings);
    setEditingCell(null);
    setNotice(`ล้างช่อง ${editingCell.day} คาบ ${editingCell.periodIndex} แล้ว`);
  }

  function printSchedule() {
    saveAll();

    const documentCode = buildOfficialDocumentCode('CC-SCH', getBangkokDate(), identity.classroomName);
    const thaiDate = formatThaiOfficialDate(getBangkokDate());
    const logoHtml = printLogoDataUrl
      ? `<img class="sch-logo" src="${printLogoDataUrl}" alt="โลโก้โรงเรียน" />`
      : '';

    // Header columns HTML for print window
    const headColumnsHtml = scheduleColumns.map((col) => {
      if (col.type === 'lunch') {
        return `<th style="width: 14mm;">พักกลางวัน<span class="sch-period-time">${col.start}-${col.end} น.</span></th>`;
      }
      return `<th>คาบที่ ${col.period.index}<span class="sch-period-time">${col.period.start}-${col.period.end} น.</span></th>`;
    }).join('');

    const dayColorClasses: Record<string, string> = {
      'จันทร์': 'day-mon',
      'อังคาร': 'day-tue',
      'พุธ': 'day-wed',
      'พฤหัสบดี': 'day-thu',
      'ศุกร์': 'day-fri',
      'เสาร์': 'day-sat',
      'อาทิตย์': 'day-sun',
    };

    const bodyRowsHtml = settings.activeDays.map((day, dayIndex) => {
      const dayClass = dayColorClasses[day] || '';
      const cellsHtml = scheduleColumns.map((col) => {
        if (col.type === 'lunch') {
          return dayIndex === 0
            ? `<td class="sch-lunch-cell" rowspan="${settings.activeDays.length}">พักรับประทานอาหารกลางวัน</td>`
            : '';
        }
        const cell = settings.cells[makeScheduleCellKey(day, col.period.index)];
        if (cell && cell.subject.trim()) {
          return `<td class="sch-cell sch-cell-active">
            <div class="sch-cell-code">${escapeOfficialHtml(cell.subjectCode || '')}</div>
            <div class="sch-cell-subject">${escapeOfficialHtml(cell.subject)}</div>
            ${cell.classroom ? `<div class="sch-cell-room">[${escapeOfficialHtml(cell.classroom)}]</div>` : ''}
          </td>`;
        }
        return `<td class="sch-cell"><span style="color:#cbd5e1;">-</span></td>`;
      }).join('');

      return `<tr>
        <th class="sch-day-cell ${dayClass}">${escapeOfficialHtml(day)}</th>
        ${cellsHtml}
      </tr>`;
    }).join('');

    const workloadItemsHtml = workloadSummary.items.map((it, idx) => {
      const rooms = Array.from(it.classrooms).join(', ');
      return `<span class="sch-workload-item">${idx + 1}. <strong>${escapeOfficialHtml(it.code ? `${it.code} ` : '')}${escapeOfficialHtml(it.name)}</strong> ${rooms ? `(${escapeOfficialHtml(rooms)})` : ''} <u>${it.count} คาบ</u></span>`;
    }).join(' &nbsp;•&nbsp; ');

    // 1. Try opening clean, dedicated standalone print window (eliminates all UI clutter)
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const html = `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <title>ตารางสอนครูรายบุคคล - ${escapeOfficialHtml(identity.teacherName || 'ครูผู้สอน')} (ปีการศึกษา ${escapeOfficialHtml(identity.academicYear)})</title>
  <style>
    @font-face {
      font-family: 'TH Sarabun New';
      font-style: normal;
      font-weight: 400;
      src: url('/fonts/THSarabun.ttf') format('truetype');
    }
    @font-face {
      font-family: 'TH Sarabun New';
      font-style: normal;
      font-weight: 700;
      src: url('/fonts/THSarabun-Bold.ttf') format('truetype');
    }
    @page {
      size: A4 landscape;
      margin: 6mm 8mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #0f172a;
      font-family: 'TH Sarabun New', 'TH Sarabun PSK', 'Sarabun', Tahoma, sans-serif;
      font-size: 13pt;
      line-height: 1.15;
    }
    .print-container {
      width: 281mm;
      max-height: 196mm;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .sch-header {
      display: grid;
      grid-template-columns: 20mm 1fr 20mm;
      align-items: center;
      border-bottom: 2px solid #0f2742;
      padding-bottom: 1.5mm;
    }
    .sch-logo-frame {
      width: 20mm;
      height: 20mm;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .sch-logo {
      max-width: 19mm;
      max-height: 19mm;
      object-fit: contain;
    }
    .sch-title-block {
      text-align: center;
    }
    .sch-school-name {
      font-size: 17pt;
      font-weight: 700;
      color: #0f2742;
      line-height: 1.08;
      margin: 0;
    }
    .sch-doc-title {
      font-size: 14.5pt;
      font-weight: 700;
      color: #0369a1;
      line-height: 1.12;
      margin-top: 0.5mm;
    }
    .sch-teacher-info {
      font-size: 12.5pt;
      font-weight: 700;
      color: #1e293b;
      line-height: 1.12;
      margin-top: 0.8mm;
    }
    .sch-meta-bar {
      display: flex;
      justify-content: space-between;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 1.5mm;
      padding: 0.8mm 3mm;
      font-size: 10pt;
      color: #334155;
      margin-top: 1.5mm;
    }
    .sch-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin-top: 2mm;
      border: 1.5px solid #0f2742;
    }
    .sch-table th, .sch-table td {
      border: 1px solid #94a3b8;
      text-align: center;
      padding: 1mm 0.8mm;
      vertical-align: middle;
      overflow: hidden;
    }
    .sch-table thead th {
      background: #e2e8f0;
      color: #0f2742;
      font-weight: 700;
      font-size: 11.5pt;
      border-bottom: 1.5px solid #0f2742;
      padding: 1.2mm 0.8mm;
      line-height: 1.08;
    }
    .sch-table thead th.day-header {
      width: 22mm;
      background: #cbd5e1;
    }
    .sch-period-time {
      font-size: 9pt;
      font-weight: 400;
      color: #475569;
      display: block;
      margin-top: 0.3mm;
    }
    .sch-day-cell {
      font-size: 13pt;
      font-weight: 700;
      width: 22mm;
      line-height: 1.1;
    }
    .day-mon { background: #fef9c3 !important; color: #713f12 !important; border-left: 3.5mm solid #eab308 !important; }
    .day-tue { background: #fce7f3 !important; color: #831843 !important; border-left: 3.5mm solid #ec4899 !important; }
    .day-wed { background: #dcfce7 !important; color: #14532d !important; border-left: 3.5mm solid #22c55e !important; }
    .day-thu { background: #ffedd5 !important; color: #7c2d12 !important; border-left: 3.5mm solid #f97316 !important; }
    .day-fri { background: #e0f2fe !important; color: #0c4a6e !important; border-left: 3.5mm solid #0ea5e9 !important; }
    .day-sat { background: #f3e8ff !important; color: #581c87 !important; border-left: 3.5mm solid #a855f7 !important; }
    .day-sun { background: #fee2e2 !important; color: #7f1d1d !important; border-left: 3.5mm solid #ef4444 !important; }
    
    .sch-cell {
      height: 13mm;
      background: #ffffff;
      padding: 0.8mm 0.8mm;
      line-height: 1.05;
    }
    .sch-cell-active {
      background: #f0fdfa;
    }
    .sch-cell-code {
      font-size: 10.5pt;
      font-weight: 700;
      color: #0f172a;
    }
    .sch-cell-subject {
      font-size: 12pt;
      font-weight: 700;
      color: #0369a1;
      margin-top: 0.2mm;
      line-height: 1.05;
    }
    .sch-cell-room {
      font-size: 9pt;
      color: #64748b;
      margin-top: 0.2mm;
    }
    .sch-lunch-cell {
      background: #f8fafc;
      color: #334155;
      font-weight: 700;
      font-size: 10.5pt;
      writing-mode: vertical-rl;
      text-orientation: mixed;
      letter-spacing: 0.1em;
      line-height: 1.1;
    }
    
    .sch-workload-strip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border: 1px solid #94a3b8;
      border-top: none;
      background: #f8fafc;
      padding: 1.2mm 2.5mm;
      font-size: 9.5pt;
    }
    .sch-workload-list {
      display: flex;
      flex-wrap: wrap;
      gap: 1mm 3mm;
      color: #1e293b;
    }
    .sch-workload-item {
      display: inline-flex;
      align-items: center;
      gap: 0.5mm;
    }
    .sch-workload-total {
      font-weight: 700;
      color: #0891b2;
      white-space: nowrap;
      padding-left: 2.5mm;
      border-left: 1px solid #cbd5e1;
    }

    .sch-cert {
      background: #f0fdfa;
      border: 1px solid #99f6e4;
      border-left: 1.2mm solid #0891b2;
      border-radius: 1.5mm;
      color: #134e4a;
      font-size: 9.5pt;
      padding: 1mm 2mm;
      margin-top: 2mm;
      text-align: center;
    }

    .sch-signatures {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4mm;
      text-align: center;
      margin-top: 3.5mm;
      font-size: 11pt;
      line-height: 1.12;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .sch-signatures p {
      margin: 0;
    }
    .sch-signatures p + p {
      margin-top: 1mm;
    }

    .sch-footer {
      border-top: 1px solid #94a3b8;
      display: flex;
      justify-content: space-between;
      font-size: 8pt;
      color: #64748b;
      padding-top: 0.8mm;
      margin-top: 1.5mm;
    }
  </style>
</head>
<body>
  <div class="print-container">
    <header class="sch-header">
      <div class="sch-logo-frame">
        ${logoHtml}
      </div>
      <div class="sch-title-block">
        <h1 class="sch-school-name">${escapeOfficialHtml(identity.schoolName || 'โรงเรียน')}</h1>
        <div class="sch-doc-title">ตารางสอนครูรายบุคคล (Teacher's Timetable)</div>
        <div class="sch-teacher-info">
          ครูผู้สอน: ${escapeOfficialHtml(identity.teacherName || '...........................................')} 
          &nbsp;&nbsp;|&nbsp;&nbsp; ตำแหน่ง: ครู 
          &nbsp;&nbsp;|&nbsp;&nbsp; ประจำชั้น: ${escapeOfficialHtml(identity.classroomName || 'ชั้น ป.5')}
          &nbsp;&nbsp;|&nbsp;&nbsp; ภาคเรียนที่ 1 ปีการศึกษา ${escapeOfficialHtml(identity.academicYear || '2569')}
        </div>
      </div>
      <div></div>
    </header>

    <div class="sch-meta-bar">
      <span>รหัสเอกสาร: <strong>${escapeOfficialHtml(documentCode)}</strong></span>
      <span>ตารางสอนประจำสัปดาห์: <strong>${escapeOfficialHtml(settings.courseTitle || 'ตารางสอน')}</strong></span>
      <span>ภาระงานสอน: <strong>${workloadSummary.totalPeriods} คาบ/สัปดาห์ (${workloadSummary.totalHours} ชม.)</strong></span>
      <span>ข้อมูล ณ วันที่: <strong>${escapeOfficialHtml(thaiDate)}</strong></span>
    </div>

    <table class="sch-table">
      <thead>
        <tr>
          <th class="day-header">วัน / เวลา</th>
          ${headColumnsHtml}
        </tr>
      </thead>
      <tbody>
        ${bodyRowsHtml}
      </tbody>
    </table>

    <div class="sch-workload-strip">
      <div class="sch-workload-list">
        <strong>สรุปรายวิชาที่สอน:</strong>
        ${workloadItemsHtml || '<span>ยังไม่มีรายวิชาในตาราง</span>'}
      </div>
      <div class="sch-workload-total">
        รวมทั้งสิ้น ${workloadSummary.totalPeriods} คาบ / สัปดาห์
      </div>
    </div>

    <div class="sch-cert">
      ขอรับรองว่าตารางสอนฉบับนี้ ได้รับการจัดสรรคาบเรียนและรายวิชาถูกต้องตามโครงสร้างหลักสูตรสถานศึกษา และตารางการจัดกิจกรรมการเรียนรู้
    </div>

    <div class="sch-signatures">
      <div>
        <p>ลงชื่อ......................................................ครูผู้สอน</p>
        <p>(${escapeOfficialHtml(identity.teacherName || '......................................................')})</p>
        <p style="font-size:9.5pt; color:#475569;">ครูผู้รับผิดชอบการสอน</p>
      </div>
      <div>
        <p>ลงชื่อ......................................................หัวหน้าวิชาการ</p>
        <p>(${escapeOfficialHtml(identity.academicHeadName || '......................................................')})</p>
        <p style="font-size:9.5pt; color:#475569;">หัวหน้าฝ่ายบริหารงานวิชาการ</p>
      </div>
      <div>
        <p>ลงชื่อ......................................................ผู้อำนวยการโรงเรียน</p>
        <p>(${escapeOfficialHtml(identity.directorName || '......................................................')})</p>
        <p style="font-size:9.5pt; color:#475569;">ผู้อำนวยการ${escapeOfficialHtml(identity.schoolName || 'โรงเรียน')}</p>
      </div>
    </div>

    <div class="sch-footer">
      <span>เอกสารควบคุมภายในสถานศึกษา · จัดทำและพิมพ์จากระบบ ClassCare 360</span>
      <span>${escapeOfficialHtml(documentCode)} · หน้า 1/1</span>
    </div>
  </div>

  <script>
    window.addEventListener('load', () => {
      window.focus();
      window.print();
    });
  </script>
</body>
</html>`;

      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      return;
    }

    // 2. Fallback if popup blocked: print on current page with upgraded schedule-print-sheet
    window.print();
  }

  const dayColorBadgeClasses: Record<string, string> = {
    'จันทร์': 'bg-amber-100 text-amber-900 border-l-4 border-amber-500',
    'อังคาร': 'bg-pink-100 text-pink-900 border-l-4 border-pink-500',
    'พุธ': 'bg-emerald-100 text-emerald-900 border-l-4 border-emerald-500',
    'พฤหัสบดี': 'bg-orange-100 text-orange-900 border-l-4 border-orange-500',
    'ศุกร์': 'bg-sky-100 text-sky-900 border-l-4 border-sky-500',
    'เสาร์': 'bg-purple-100 text-purple-900 border-l-4 border-purple-500',
    'อาทิตย์': 'bg-rose-100 text-rose-900 border-l-4 border-rose-500',
  };

  return (
    <main className="app-page">
      <style>{`
        @font-face {
          font-family: 'TH Sarabun PSK';
          font-style: normal;
          font-weight: 400;
          src: url('/fonts/THSarabun.ttf') format('truetype');
        }
        @font-face {
          font-family: 'TH Sarabun PSK';
          font-style: normal;
          font-weight: 700;
          src: url('/fonts/THSarabun-Bold.ttf') format('truetype');
        }
        @media print {
          @page { size: A4 landscape; margin: 6mm 8mm; }
          html, body { background: #fff !important; font-family: 'TH Sarabun New', 'TH Sarabun PSK', serif !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; margin: 0 !important; padding: 0 !important; }
          .app-sidebar, .app-shell-sidebar, .app-topbar, .app-mobile-nav, .print-hidden, .no-print, .app-context-nav, .support-widget, .app-ambient-background, .app-shell-ambient, .system-broadcast-banner { display: none !important; }
          .app-page { padding: 0 !important; margin: 0 !important; background: #fff !important; }
          .app-page > :not(.schedule-print-sheet) { display: none !important; }
          .schedule-screen { display: none !important; }
          .schedule-print-sheet { box-sizing: border-box !important; display: block !important; width: 281mm !important; max-height: 196mm !important; margin: 0 auto !important; padding: 0 !important; color: #0f172a !important; font-size: 13pt !important; line-height: 1.15 !important; page-break-inside: avoid !important; break-inside: avoid !important; }
          .schedule-print-sheet * { font-family: 'TH Sarabun New', 'TH Sarabun PSK', 'Noto Sans Thai', sans-serif !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>

      {/* Upgraded Authentic Thai Timetable Sheet (Used for in-page fallback print) */}
      <section className="schedule-print-sheet hidden bg-white p-2 text-slate-900">
        <div className="w-full max-h-[196mm] flex flex-col justify-between">
          <header className="grid grid-cols-[20mm_1fr_20mm] items-center border-b-2 border-slate-900 pb-1.5">
            <div className="flex h-16 w-16 items-center justify-center">
              {printLogoDataUrl ? (
                <img alt="school logo" className="max-h-16 max-w-16 object-contain" src={printLogoDataUrl} />
              ) : null}
            </div>
            <div className="text-center">
              <h1 className="text-xl font-bold leading-tight text-slate-900">{identity.schoolName || 'โรงเรียน'}</h1>
              <p className="mt-0.5 text-base font-bold text-sky-800">ตารางสอนครูรายบุคคล (Teacher's Timetable)</p>
              <p className="mt-1 text-sm font-bold text-slate-800">
                ครูผู้สอน: {identity.teacherName || '...........................................'} &nbsp;|&nbsp; 
                ตำแหน่ง: ครู &nbsp;|&nbsp; 
                ประจำชั้น: {identity.classroomName || 'ชั้น ป.5'} &nbsp;|&nbsp; 
                ภาคเรียนที่ 1 ปีการศึกษา {identity.academicYear || '2569'}
              </p>
            </div>
            <div />
          </header>

          <div className="mt-1.5 flex justify-between rounded-md border border-slate-300 bg-slate-50 px-3 py-1 text-xs text-slate-700">
            <span>รหัสเอกสาร: <strong>{buildOfficialDocumentCode('CC-SCH', getBangkokDate(), identity.classroomName)}</strong></span>
            <span>ตารางสอนประจำสัปดาห์: <strong>{settings.courseTitle || 'ตารางสอน'}</strong></span>
            <span>ภาระงานสอน: <strong>{workloadSummary.totalPeriods} คาบ/สัปดาห์ ({workloadSummary.totalHours} ชม.)</strong></span>
            <span>ข้อมูล ณ วันที่: <strong>{formatThaiOfficialDate(getBangkokDate())}</strong></span>
          </div>

          <table className="mt-2 w-full border-collapse border border-slate-900 text-center text-xs">
            <thead>
              <tr className="bg-slate-200 text-slate-900">
                <th className="w-20 border border-slate-400 bg-slate-300 p-1.5 text-sm font-bold">วัน / เวลา</th>
                {scheduleColumns.map((column) =>
                  column.type === 'lunch' ? (
                    <th className="w-14 border border-slate-400 p-1 text-xs font-bold" key={column.key}>
                      พักกลางวัน
                      <span className="block text-[10px] font-normal text-slate-600">{column.start}-{column.end} น.</span>
                    </th>
                  ) : (
                    <th className="border border-slate-400 p-1 text-xs font-bold" key={column.period.index}>
                      คาบที่ {column.period.index}
                      <span className="block text-[10px] font-normal text-slate-600">{column.period.start}-{column.period.end} น.</span>
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {settings.activeDays.map((day, dayIndex) => {
                const dayBadge = dayColorBadgeClasses[day] || 'bg-slate-100 text-slate-900';
                return (
                  <tr key={day}>
                    <th className={`w-20 border border-slate-400 p-1.5 text-sm font-bold ${dayBadge}`}>{day}</th>
                    {scheduleColumns.map((column) => {
                      if (column.type === 'lunch') {
                        return dayIndex === 0 ? (
                          <td
                            className="border border-slate-400 bg-slate-50 p-1 align-middle text-xs font-bold text-slate-700"
                            key={column.key}
                            rowSpan={settings.activeDays.length}
                            style={{ writingMode: 'vertical-rl', letterSpacing: '0.1em' }}
                          >
                            พักรับประทานอาหารกลางวัน
                          </td>
                        ) : null;
                      }

                      const { period } = column;
                      const cell = settings.cells[makeScheduleCellKey(day, period.index)];
                      return (
                        <td className="h-12 border border-slate-400 p-1 align-middle text-xs leading-tight" key={period.index}>
                          {cell && cell.subject.trim() ? (
                            <>
                              <div className="font-bold text-slate-900">{cell.subjectCode || ''}</div>
                              <div className="mt-0.5 font-bold text-sky-700">{cell.subject}</div>
                              {cell.classroom ? (
                                <div className="mt-0.5 text-[10px] text-slate-500">[{cell.classroom}]</div>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Workload summary strip */}
          <div className="flex items-center justify-between border-x border-b border-slate-400 bg-slate-50 px-3 py-1 text-xs">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-slate-800">
              <strong>สรุปรายวิชาที่สอน:</strong>
              {workloadSummary.items.map((it, idx) => {
                const rooms = Array.from(it.classrooms).join(', ');
                return (
                  <span key={it.name}>
                    {idx + 1}. <strong>{it.code ? `${it.code} ` : ''}{it.name}</strong> {rooms ? `(${rooms})` : ''} <u>{it.count} คาบ</u>
                  </span>
                );
              })}
            </div>
            <div className="whitespace-nowrap border-l border-slate-300 pl-3 font-bold text-cyan-800">
              รวมทั้งสิ้น {workloadSummary.totalPeriods} คาบ / สัปดาห์
            </div>
          </div>

          <div className="mt-2 rounded-md border border-teal-200 border-l-4 border-l-teal-600 bg-teal-50/80 px-2.5 py-1 text-center text-[11px] text-teal-900">
            ขอรับรองว่าตารางสอนฉบับนี้ ได้รับการจัดสรรคาบเรียนและรายวิชาถูกต้องตามโครงสร้างหลักสูตรสถานศึกษา และตารางการจัดกิจกรรมการเรียนรู้
          </div>

          <div className="mt-3 grid grid-cols-3 gap-6 text-center text-sm leading-normal">
            <div>
              <p>ลงชื่อ......................................................ครูผู้สอน</p>
              <p className="mt-1">({identity.teacherName || '......................................................'})</p>
              <p className="text-xs text-slate-500">ครูผู้รับผิดชอบการสอน</p>
            </div>
            <div>
              <p>ลงชื่อ......................................................หัวหน้าวิชาการ</p>
              <p className="mt-1">({identity.academicHeadName || '......................................................'})</p>
              <p className="text-xs text-slate-500">หัวหน้าฝ่ายบริหารงานวิชาการ</p>
            </div>
            <div>
              <p>ลงชื่อ......................................................ผู้อำนวยการโรงเรียน</p>
              <p className="mt-1">({identity.directorName || '......................................................'})</p>
              <p className="text-xs text-slate-500">ผู้อำนวยการ{identity.schoolName || 'โรงเรียน'}</p>
            </div>
          </div>

          <div className="mt-2 flex justify-between border-t border-slate-400 pt-1 text-[10px] text-slate-500">
            <span>เอกสารควบคุมภายในสถานศึกษา · จัดทำและพิมพ์จากระบบ ClassCare 360</span>
            <span>{buildOfficialDocumentCode('CC-SCH', getBangkokDate(), identity.classroomName)} · หน้า 1/1</span>
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
          <section className="schedule-v2 app-panel-pad overflow-hidden">
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
              </div>
            </div>

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
                <button
                  className="nexus-pill inline-flex h-11 items-center justify-center gap-2 px-4 text-sm font-black text-amber-900 bg-amber-50 hover:bg-amber-100 ring-1 ring-amber-300 shadow-sm"
                  onClick={() => setIsOcrModalOpen(true)}
                  type="button"
                >
                  <Sparkles size={17} aria-hidden="true" className="text-amber-600" />
                  สแกนตารางด้วย AI
                </button>
                <button className="amber-action inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black" onClick={() => saveAll()} type="button">
                  <Save size={17} aria-hidden="true" />
                  บันทึกตาราง
                </button>
                <button className="nexus-pill inline-flex h-11 items-center justify-center gap-2 px-4 text-sm font-black text-slate-700" onClick={printSchedule} type="button">
                  <Printer size={17} aria-hidden="true" />
                  พิมพ์ A4 แนวนอน
                </button>
                <Link className="nexus-pill inline-flex h-11 items-center justify-center gap-2 px-4 text-sm font-black text-slate-700" to="/app/dashboard?view=reports&reportView=subject-attendance">
                  <FileSpreadsheet size={17} aria-hidden="true" />
                  รายงาน / พิมพ์ตารางสอน
                </Link>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto">
              <div className="min-w-[980px] rounded-[2rem] border border-[#e3b875] bg-[#fff7df] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.55)]">
                <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-white/80 p-3">
                  <div className="flex items-center gap-3">
                    {printLogoDataUrl ? <img alt="โลโก้โรงเรียน" className="h-12 w-12 object-contain" src={printLogoDataUrl} /> : null}
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

                <div className="grid gap-2" style={{ gridTemplateColumns: `110px repeat(${scheduleColumns.length}, minmax(96px, 1fr))` }}>
                  <div className="grid min-h-20 place-items-center rounded-2xl bg-[#dfae6d] p-2 text-center text-lg font-black text-white">
                    วัน/เวลา
                  </div>
                  {scheduleColumns.map((column) =>
                    column.type === 'lunch' ? (
                      <div className="grid min-h-20 place-items-center rounded-2xl bg-[#fff1c9] p-2 text-center font-black text-[#7a4f26] ring-1 ring-[#e6bd70]" key={column.key}>
                        <span>พักเที่ยง</span>
                        <span className="text-xs leading-5">{column.start}<br />{column.end}</span>
                      </div>
                    ) : (
                      <div className="grid min-h-20 place-items-center rounded-2xl bg-[#dfae6d] p-2 text-center font-black text-white" key={column.period.index}>
                        <span>{column.period.label}</span>
                        <span className="text-xs leading-5">{column.period.start}<br />{column.period.end}</span>
                      </div>
                    ),
                  )}

                  {settings.activeDays.map((day) => (
                    <Fragment key={day}>
                      <div className="grid min-h-20 place-items-center rounded-2xl bg-[#dfae6d] p-2 text-lg font-black text-white">
                        {day}
                      </div>
                      {scheduleColumns.map((column) => {
                        if (column.type === 'lunch') {
                          return (
                            <div
                              className="grid min-h-20 place-items-center rounded-2xl border border-[#e6bd70] bg-[#fff8df] p-2 text-center text-sm font-black text-[#7a4f26]"
                              key={`${day}-${column.key}`}
                            >
                              พักกลางวัน
                            </div>
                          );
                        }

                        const { period } = column;
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
                                <div className="flex items-center justify-between gap-1">
                                  <p className="text-xs font-black opacity-80">{cell.subjectCode || '-'}</p>
                                  {formatScheduleClassroom(cell.classroom) ? (
                                    <span className="rounded bg-amber-200/90 text-amber-950 font-black px-1.5 py-0.5 text-[10px] shadow-2xs">
                                      {formatScheduleClassroom(cell.classroom)}
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-1 text-sm font-black leading-tight">{cell.subject}</p>
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

            {editingCell ? (
              <div
                aria-modal="true"
                className="no-print fixed inset-0 z-50 grid place-items-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) setEditingCell(null);
                }}
                role="dialog"
              >
                <div className="w-full max-w-2xl rounded-[2rem] border border-[#e6bd70] bg-white p-5 shadow-[0_28px_80px_rgba(15,23,42,0.28)]">
                  <div className="flex flex-col gap-3 border-b border-[#ead8bd] pb-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b46a00]">เลือกวิชาในตาราง</p>
                      <h3 className="mt-1 text-2xl font-black text-slate-950">
                        {editingCell.day} / {editingPeriod?.label || `คาบ ${editingCell.periodIndex}`}
                      </h3>
                      <p className="mt-1 text-sm font-bold text-slate-500">
                        {editingPeriod ? `${editingPeriod.start} - ${editingPeriod.end} น.` : 'เลือกวิชาและห้องเรียนสำหรับช่องนี้'}
                      </p>
                    </div>
                    <button className="nexus-pill h-10 px-4 text-sm font-black text-slate-600" onClick={() => setEditingCell(null)} type="button">
                      ปิด
                    </button>
                  </div>

                  <div className="mt-5 grid gap-4">
                    <label className="grid gap-2 text-sm font-black text-slate-700">
                      รายวิชา
                      <select className="nexus-field h-12 px-3" onChange={(event) => updateCellDraftSubject(event.target.value)} value={cellDraft.subject}>
                        {settings.subjects.length ? null : <option value={cellDraft.subject}>{cellDraft.subject || 'ไม่ระบุวิชา'}</option>}
                        {settings.subjects.map((subject) => (
                          <option key={subject.name} value={subject.name}>
                            {subject.code ? `${subject.code} - ${subject.name}` : subject.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3">
                      <p className="text-sm font-black text-sky-950">ยังไม่มีวิชาที่ต้องการ?</p>
                      <div className="mt-2 flex gap-2">
                        <input className="nexus-field h-10 flex-1 bg-white px-3" onChange={(event) => setQuickSubjectName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addQuickSubject(); } }} placeholder="พิมพ์ชื่อวิชา แล้วกดเพิ่ม" value={quickSubjectName} />
                        <button className="amber-action inline-flex h-10 shrink-0 items-center gap-1 rounded-xl px-3 text-sm font-black" onClick={addQuickSubject} type="button"><Plus size={16} /> เพิ่ม</button>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="grid gap-2 text-sm font-black text-slate-700">
                        รหัสวิชา
                        <input
                          className="nexus-field h-12 px-3"
                          onChange={(event) => setCellDraft((current) => ({ ...current, subjectCode: event.target.value }))}
                          placeholder="เช่น ค15101"
                          value={cellDraft.subjectCode || ''}
                        />
                      </label>
                      <label className="grid gap-2 text-sm font-black text-slate-700">
                        ห้องเรียนที่สอนคาบนี้
                        <select className="nexus-field h-12 px-3" onChange={(event) => setCellDraft((current) => ({ ...current, classroom: event.target.value }))} value={cellDraft.classroom}>
                          <option value="">ไม่ระบุห้องเรียน / ทุกห้อง (กิจกรรมรวม)</option>
                          {scheduleClassroomOptions.map((classroom) => (
                            <option key={classroom.value} value={classroom.value}>
                              {classroom.label}
                            </option>
                          ))}
                        </select>
                        <span className="text-xs font-bold leading-5 text-slate-500">
                          เลือกห้องที่สอน หรือเลือก “ไม่ระบุห้องเรียน / ทุกห้อง” สำหรับชุมนุม สวดมนต์ และกิจกรรมรวม
                        </span>
                        <Link className="text-xs font-black text-sky-700 hover:text-sky-900" to="/app/dashboard?view=workspace-settings#workspace-classrooms">
                          + เพิ่มห้องเรียน/ชั้นอื่นก่อนจัดตาราง
                        </Link>
                      </label>
                    </div>

                    <div className="rounded-3xl border border-[#ead8bd] bg-[#fffaf0] p-4">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#b46a00]">ตัวอย่างในช่อง</p>
                      <div className="mt-3 rounded-2xl bg-[#4b2f18] p-4 text-white">
                        <p className="text-sm font-black opacity-80">{cellDraft.subjectCode || '-'}</p>
                        <p className="mt-1 text-lg font-black">{cellDraft.subject || 'ยังไม่ได้เลือกวิชา'}</p>
                        {formatScheduleClassroom(cellDraft.classroom) ? (
                          <p className="mt-1 text-sm font-bold opacity-80">{formatScheduleClassroom(cellDraft.classroom)}</p>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                      <button className="amber-action inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black" onClick={saveEditingCell} type="button">
                        <Save size={17} aria-hidden="true" />
                        บันทึกช่องนี้
                      </button>
                      <button className="nexus-pill inline-flex h-12 items-center justify-center gap-2 px-5 text-sm font-black text-rose-600 ring-rose-200" onClick={clearEditingCell} type="button">
                        <Trash2 size={17} aria-hidden="true" />
                        ล้างช่อง
                      </button>
                      <button className="nexus-pill h-12 px-5 text-sm font-black text-slate-600" onClick={() => setEditingCell(null)} type="button">
                        ยกเลิก
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        )}
      </div>

      <ScheduleOcrModal
        classroomOptions={settings.classroomOptions}
        defaultClassroom={selectedClassroom || session.workspace?.classroomName || 'ป.5/1'}
        defaultTeacherName={identity.teacherName || session.profile?.displayName || ''}
        isOpen={isOcrModalOpen}
        onApplySchedule={handleApplySchedule}
        onClose={() => setIsOcrModalOpen(false)}
        session={session}
      />
    </main>
  );
}
