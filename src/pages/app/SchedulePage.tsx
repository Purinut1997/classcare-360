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
import { buildOfficialDocumentCode, formatThaiOfficialDate } from '../../lib/officialReport';
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
    window.print();
  }

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
        @font-face {
          font-family: 'TH Sarabun PSK';
          font-style: italic;
          font-weight: 400;
          src: url('/fonts/THSarabun-Italic.ttf') format('truetype');
        }
        @font-face {
          font-family: 'TH Sarabun PSK';
          font-style: italic;
          font-weight: 700;
          src: url('/fonts/THSarabun-BoldItalic.ttf') format('truetype');
        }
        @media print {
          @page { size: A4 landscape; margin: 12mm; }
          html, body { background: #fff !important; font-family: 'TH Sarabun PSK', 'TH Sarabun New', serif !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .app-sidebar, .app-shell-sidebar, .app-topbar, .app-mobile-nav, .print-hidden, .no-print { display: none !important; }
          .app-page { padding: 0 !important; background: #fff !important; }
          .app-page > :not(.schedule-print-sheet) { display: none !important; }
          .classcare-grid-bg { background: #fff !important; overflow: visible !important; }
          .classcare-grid-bg > .pointer-events-none,
          .classcare-grid-bg > .fixed { display: none !important; }
          .schedule-print-sheet { box-sizing: border-box !important; display: block !important; width: 273mm !important; min-height: 0 !important; margin: 0 auto !important; padding: 0 !important; color: #0f172a !important; font-size: 16pt !important; line-height: 1 !important; }
          .schedule-print-sheet, .schedule-print-sheet * { font-family: 'TH Sarabun New', 'TH Sarabun PSK', 'Noto Sans Thai', sans-serif !important; }
          .schedule-print-sheet > div { min-height: 0 !important; }
          .schedule-screen { display: none !important; }
          .schedule-print-title { font-size: 21pt !important; line-height: 1.08 !important; }
          .schedule-print-subtitle { margin-top: 1mm !important; font-size: 17pt !important; line-height: 1.08 !important; }
          .schedule-print-teacher { margin-top: 1mm !important; font-size: 16pt !important; line-height: 1.08 !important; }
          .schedule-print-meta { background: #f8fafc !important; border: 1px solid #cbd5e1 !important; border-radius: 2.5mm !important; display: flex !important; font-size: 12.5pt !important; justify-content: space-between !important; margin-top: 3mm !important; padding: 1.5mm 2.5mm !important; }
          .schedule-print-table { border: 1px solid #b8c7d9 !important; border-collapse: separate !important; border-radius: 2.5mm !important; border-spacing: 0 !important; margin-top: 4mm !important; overflow: hidden !important; font-size: 15pt !important; line-height: 1.02 !important; table-layout: fixed !important; }
          .schedule-print-table th, .schedule-print-table td { border: 0 !important; border-bottom: 1px solid #d8e1eb !important; border-right: 1px solid #d8e1eb !important; padding: 2.5px !important; }
          .schedule-print-table tr > :last-child { border-right: 0 !important; }
          .schedule-print-table tbody tr:last-child > * { border-bottom: 0 !important; }
          .schedule-print-table thead th { background: #e6f7fb !important; border-top: .8mm solid #0f2742 !important; color: #0f2742 !important; font-size: 15.5pt !important; line-height: 1.05 !important; font-weight: 700 !important; }
          .schedule-print-table tbody th { background: #e6f7fb !important; color: #0f2742 !important; }
          .schedule-print-table tbody tr:nth-child(even) td { background: #f8fafc !important; }
          .schedule-print-table thead span { font-size: 13.5pt !important; line-height: 1 !important; }
          .schedule-print-day { width: 24mm !important; }
          .schedule-print-day-label { font-size: 16.5pt !important; line-height: 1.05 !important; }
          .schedule-print-cell { height: 18.5mm !important; font-size: 15pt !important; line-height: 1.05 !important; }
          .schedule-print-cell-code { font-size: 13.5pt !important; line-height: 1 !important; }
          .schedule-print-cell-subject { margin-top: 0.5mm !important; font-size: 16pt !important; line-height: 1.03 !important; font-weight: 700 !important; }
          .schedule-print-cell-classroom { margin-top: 0.5mm !important; font-size: 13pt !important; line-height: 1 !important; }
          .schedule-print-lunch { width: 16mm !important; font-size: 14pt !important; line-height: 1 !important; writing-mode: vertical-rl; text-orientation: mixed; letter-spacing: 0.06em; }
          .schedule-print-signatures { margin-top: 5mm !important; font-size: 15pt !important; line-height: 1.08 !important; }
          .schedule-print-signatures p + p { margin-top: 1mm !important; }
          .schedule-print-certification { background: #f0fdfa !important; border: 1px solid #99f6e4 !important; border-left: 1.4mm solid #0891b2 !important; border-radius: 2mm !important; color: #134e4a !important; font-size: 12.5pt !important; margin-top: 3mm !important; padding: 1.5mm 2mm !important; }
          .schedule-print-footer { border-top: 1px solid #666 !important; display: flex !important; font-size: 9pt !important; justify-content: space-between !important; margin-top: 4mm !important; padding-top: 1mm !important; }
        }
      `}</style>

      <section className="schedule-print-sheet hidden bg-white p-8 text-black">
        <div className="relative">
          {printLogoDataUrl ? (
            <img alt="school logo" className="absolute left-0 top-0 h-20 w-20 object-contain" src={printLogoDataUrl} />
          ) : null}
          <div className="mx-auto max-w-[920px] text-center">
            <h1 className="schedule-print-title text-xl font-bold">{identity.schoolName}</h1>
            <p className="schedule-print-subtitle mt-2 text-lg font-bold">{settings.courseTitle || 'ตารางสอนประจำสัปดาห์'} ปีการศึกษา {identity.academicYear}</p>
            <p className="schedule-print-teacher mt-2 text-lg font-bold">ครูผู้สอน {identity.teacherName || '................................................'}</p>
          </div>
          <div className="schedule-print-meta">
            <span>ชั้น/ห้อง: {identity.classroomName || session.workspace?.classroomName || '-'}</span>
            <span>รหัสเอกสาร: {buildOfficialDocumentCode('CC-SCH', getBangkokDate(), identity.classroomName)}</span>
            <span>ข้อมูล ณ {formatThaiOfficialDate(getBangkokDate())}</span>
          </div>

          <table className="schedule-print-table mt-7 w-full border-collapse text-center text-[12px]">
            <thead>
              <tr>
                <th className="schedule-print-day w-24 border border-black p-2">วัน / เวลา</th>
                {scheduleColumns.map((column) =>
                  column.type === 'lunch' ? (
                    <th className="border border-black p-2" key={column.key}>
                      พักเที่ยง
                      <br />
                      <span className="font-normal">{column.start}-{column.end} น.</span>
                    </th>
                  ) : (
                    <th className="border border-black p-2" key={column.period.index}>
                      ชั่วโมงที่ {column.period.index}
                      <br />
                      <span className="font-normal">{column.period.start}-{column.period.end} น.</span>
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {settings.activeDays.map((day, dayIndex) => (
                <tr key={day}>
                  <th className="schedule-print-day-label border border-black p-2 text-lg">{day}</th>
                  {scheduleColumns.map((column) => {
                    if (column.type === 'lunch') {
                      return dayIndex === 0 ? (
                        <td
                          className="schedule-print-lunch border border-black bg-slate-50 p-2 align-middle text-base font-bold"
                          key={column.key}
                          rowSpan={settings.activeDays.length}
                        >
                          พักกลางวัน
                        </td>
                      ) : null;
                    }

                    const { period } = column;
                    const cell = settings.cells[makeScheduleCellKey(day, period.index)];
                    return (
                      <td className="schedule-print-cell h-20 border border-black p-2 align-middle" key={period.index}>
                        {cell ? (
                          <>
                            <div className="schedule-print-cell-code">{cell.subjectCode || ''}</div>
                            <div className="schedule-print-cell-subject mt-2">{cell.subject}</div>
                            {formatScheduleClassroom(cell.classroom) ? (
                              <div className="schedule-print-cell-classroom mt-1 text-sm">{formatScheduleClassroom(cell.classroom)}</div>
                            ) : null}
                          </>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="schedule-print-certification">ขอรับรองว่าตารางสอนฉบับนี้ได้รับการตรวจสอบความถูกต้องของรายวิชา เวลาเรียน ห้องเรียน และผู้สอนแล้ว</div>

          <div className="schedule-print-signatures mt-9 grid grid-cols-3 gap-8 text-center text-base">
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
          <div className="schedule-print-footer"><span>เอกสารควบคุมภายในสถานศึกษา · พิมพ์จากระบบ ClassCare 360</span><span>{buildOfficialDocumentCode('CC-SCH', getBangkokDate(), identity.classroomName)} · หน้า 1/1</span></div>
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
                                <p className="text-xs font-black opacity-80">{cell.subjectCode || '-'}</p>
                                <p className="mt-1 text-sm font-black">{cell.subject}</p>
                                {formatScheduleClassroom(cell.classroom) ? (
                                  <p className="mt-1 text-xs font-bold opacity-80">{formatScheduleClassroom(cell.classroom)}</p>
                                ) : null}
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
        isOpen={isOcrModalOpen}
        onApplySchedule={handleApplySchedule}
        onClose={() => setIsOcrModalOpen(false)}
        session={session}
      />
    </main>
  );
}
