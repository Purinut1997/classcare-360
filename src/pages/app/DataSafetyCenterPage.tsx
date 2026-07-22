import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  DatabaseZap,
  FileWarning,
  MessageSquareText,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type { AppSessionContext } from '../../types/core';

interface DataSafetyCenterPageProps {
  session: AppSessionContext;
}

type UiMode = 'simple' | 'advanced';
type TrashKind = 'student' | 'classroom' | 'workspace' | 'score_set' | 'attendance_session';
type HealthSeverity = 'danger' | 'warning' | 'info';

interface TrashItem {
  id: string;
  kind: TrashKind;
  title: string;
  detail: string;
  deletedBy: string;
  deletedAt: string;
  restored?: boolean;
  permanentlyDeleted?: boolean;
}

interface HealthIssue {
  id: string;
  severity: HealthSeverity;
  title: string;
  detail: string;
  action: string;
  resolved?: boolean;
}

interface CalendarRule {
  id: string;
  date: string;
  title: string;
  type: 'holiday' | 'exam' | 'activity' | 'makeup' | 'custom';
  attendancePolicy: 'skip' | 'warn' | 'normal';
}

interface MessageTemplate {
  id: string;
  category: string;
  title: string;
  body: string;
}

interface DataSafetyState {
  mode: UiMode;
  importChecked: boolean;
  lastImportAction: string;
  trashItems: TrashItem[];
  healthIssues: HealthIssue[];
  calendarRules: CalendarRule[];
  templates: MessageTemplate[];
}

const trashKindLabels: Record<TrashKind, string> = {
  student: 'นักเรียน',
  classroom: 'ห้องเรียน',
  workspace: 'workspace',
  score_set: 'ชุดคะแนน',
  attendance_session: 'รอบเช็คชื่อ',
};

const healthStyles: Record<HealthSeverity, string> = {
  danger: 'border-rose-200 bg-rose-50 text-rose-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  info: 'border-cyan-200 bg-cyan-50 text-cyan-700',
};

function createDefaultState(session: AppSessionContext): DataSafetyState {
  const schoolName = session.workspace?.schoolName || session.profile.schoolName || 'โรงเรียนตัวอย่าง';
  const today = new Date().toISOString().slice(0, 10);

  return {
    mode: 'simple',
    importChecked: false,
    lastImportAction: 'ยังไม่ได้ตรวจไฟล์นำเข้าในรอบนี้',
    trashItems: [
      {
        id: 'trash-student-demo',
        kind: 'student',
        title: 'รายชื่อนักเรียน import ซ้ำ 5 รายการ',
        detail: 'ควรกู้คืนเฉพาะรายการที่ลบผิด หรือปล่อยไว้ในถังขยะ 30 วันก่อนลบถาวร',
        deletedBy: session.profile.email,
        deletedAt: today,
      },
      {
        id: 'trash-score-demo',
        kind: 'score_set',
        title: 'ชุดคะแนน แบบทดสอบบทที่ 1',
        detail: 'มีคะแนนกรอก 0 รายการ กู้คืนได้ทันทีหากลบผิด',
        deletedBy: session.profile.email,
        deletedAt: today,
      },
      {
        id: 'trash-classroom-demo',
        kind: 'classroom',
        title: 'ห้อง อ.3/1 ปี 2569',
        detail: 'ห้องว่างไม่มีนักเรียน เหมาะกับลบถาวรหลังตรวจซ้ำ',
        deletedBy: session.profile.email,
        deletedAt: today,
      },
    ],
    healthIssues: [
      {
        id: 'health-duplicate',
        severity: 'danger',
        title: 'พบความเสี่ยงรายชื่อนักเรียนซ้ำ',
        detail: 'นักเรียนรหัสซ้ำหรือชื่อ-นามสกุลซ้ำควรถูกรวมก่อนใช้คะแนน/รายงาน',
        action: 'เปิด Data Quality และรวมรายการซ้ำ',
      },
      {
        id: 'health-room',
        severity: 'warning',
        title: 'มีนักเรียนที่ยังไม่ผูกห้องเรียน',
        detail: 'ระบบคะแนน เวลาเรียน เงินออม และรายงานจะไม่เห็นนักเรียนที่ไม่มี classroom_id',
        action: 'กำหนดห้องเรียนให้นักเรียน',
      },
      {
        id: 'health-report',
        severity: 'info',
        title: 'ยังไม่ได้ตั้งค่าหัวรายงานครบ',
        detail: 'โลโก้โรงเรียน ครูผู้สอน หัวหน้าวิชาการ และผู้อำนวยการควรอยู่ในตั้งค่าโรงเรียน',
        action: 'ไปตั้งค่าโรงเรียนและผู้ลงนาม',
      },
    ],
    calendarRules: [
      {
        id: 'calendar-exam',
        date: today,
        title: 'สอบกลางภาค',
        type: 'exam',
        attendancePolicy: 'warn',
      },
      {
        id: 'calendar-activity',
        date: today,
        title: `${schoolName} จัดกิจกรรมหน้าเสาธง`,
        type: 'activity',
        attendancePolicy: 'normal',
      },
    ],
    templates: [
      {
        id: 'tpl-absence',
        category: 'เวลาเรียน',
        title: 'แจ้งนักเรียนขาดเรียน',
        body: 'เรียนผู้ปกครอง {{student_name}} วันนี้ระบบบันทึกสถานะ {{status}} หากมีใบลา กรุณาแจ้งครูประจำชั้น',
      },
      {
        id: 'tpl-care',
        category: 'เคสดูแล',
        title: 'นัดติดตามเคสดูแล',
        body: 'ครูขอนัดติดตามข้อมูลของ {{student_name}} เรื่อง {{case_type}} เพื่อดูแลต่อเนื่อง',
      },
    ],
  };
}

function getStorageKey(session: AppSessionContext) {
  return `classcare:data-safety:${session.workspace?.id || session.profile.id}`;
}

function StatCard({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="compact-stat text-left">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className={`mt-2 text-3xl font-black ${tone || 'text-slate-950'}`}>{value}</p>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-black text-slate-600">{children}</label>;
}

export function DataSafetyCenterPage({ session }: DataSafetyCenterPageProps) {
  const storageKey = getStorageKey(session);
  const [state, setState] = useState<DataSafetyState>(() => createDefaultState(session));
  const [calendarDraft, setCalendarDraft] = useState({
    date: new Date().toISOString().slice(0, 10),
    title: '',
    type: 'activity' as CalendarRule['type'],
    attendancePolicy: 'warn' as CalendarRule['attendancePolicy'],
  });
  const [templateDraft, setTemplateDraft] = useState({
    category: 'ทั่วไป',
    title: '',
    body: 'เรียนผู้ปกครอง {{student_name}} {{message}}',
  });

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) setState(JSON.parse(raw) as DataSafetyState);
    } catch {
      setState(createDefaultState(session));
    }
  }, [session, storageKey]);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [state, storageKey]);

  const summary = useMemo(() => {
    const openTrash = state.trashItems.filter((item) => !item.restored && !item.permanentlyDeleted).length;
    const openIssues = state.healthIssues.filter((item) => !item.resolved).length;
    const warningCalendar = state.calendarRules.filter((item) => item.attendancePolicy !== 'normal').length;

    return { openTrash, openIssues, warningCalendar };
  }, [state]);

  const runImportSafetyCheck = () => {
    setState((current) => ({
      ...current,
      importChecked: true,
      lastImportAction:
        'ตรวจแล้ว: พบกฎป้องกันซ้ำ 6 ข้อพร้อมใช้งาน ระบบจะ preview ก่อน import จริงและบันทึก import batch ทุกครั้ง',
      healthIssues: current.healthIssues.map((issue) =>
        issue.id === 'health-duplicate' ? { ...issue, resolved: true } : issue,
      ),
    }));
  };

  const restoreTrash = (id: string) => {
    setState((current) => ({
      ...current,
      trashItems: current.trashItems.map((item) => (item.id === id ? { ...item, restored: true } : item)),
    }));
  };

  const deleteTrashForever = (id: string) => {
    setState((current) => ({
      ...current,
      trashItems: current.trashItems.map((item) =>
        item.id === id ? { ...item, permanentlyDeleted: true } : item,
      ),
    }));
  };

  const resolveHealthIssue = (id: string) => {
    setState((current) => ({
      ...current,
      healthIssues: current.healthIssues.map((issue) => (issue.id === id ? { ...issue, resolved: true } : issue)),
    }));
  };

  const addCalendarRule = () => {
    if (!calendarDraft.title.trim()) return;
    setState((current) => ({
      ...current,
      calendarRules: [
        {
          id: `calendar-${Date.now()}`,
          date: calendarDraft.date,
          title: calendarDraft.title.trim(),
          type: calendarDraft.type,
          attendancePolicy: calendarDraft.attendancePolicy,
        },
        ...current.calendarRules,
      ],
    }));
    setCalendarDraft((current) => ({ ...current, title: '' }));
  };

  const addTemplate = () => {
    if (!templateDraft.title.trim() || !templateDraft.body.trim()) return;
    setState((current) => ({
      ...current,
      templates: [
        {
          id: `template-${Date.now()}`,
          category: templateDraft.category.trim() || 'ทั่วไป',
          title: templateDraft.title.trim(),
          body: templateDraft.body.trim(),
        },
        ...current.templates,
      ],
    }));
    setTemplateDraft((current) => ({ ...current, title: '' }));
  };

  return (
    <main className="app-page">
      <div className="app-page-header">
        <div>
          <span className="nexus-kicker">
            <DatabaseZap size={16} aria-hidden="true" />
            Data Safety Center
          </span>
          <h1 className="app-page-title">ศูนย์ดูแลข้อมูลที่ครูใช้ก่อนงานจริง</h1>
          <p className="app-page-description">
            หน้านี้รวมระบบกันข้อมูลพังจากไฟล์ import, ลบผิด, รายชื่อซ้ำ, ปฏิทินโรงเรียน, โหมดใช้งาน และข้อความสำเร็จรูป
            เพื่อให้ข้อมูลนักเรียนพร้อมก่อนต่อไปยังเวลาเรียน คะแนน เงินออม พฤติกรรม และรายงาน
          </p>
        </div>

        <div className="nexus-card p-4 text-sm font-black text-slate-700">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">workspace</p>
          <p className="mt-1 text-xl text-slate-950">{session.workspace?.schoolName || 'ยังไม่ได้เลือกโรงเรียน'}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            สถานะ: {state.mode === 'simple' ? 'Simple Mode' : 'Advanced Mode'}
          </p>
        </div>
      </div>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="ตรวจ import" value={state.importChecked ? 'ผ่าน' : 'รอตรวจ'} tone="text-cyan-700" />
        <StatCard label="ในถังขยะ" value={summary.openTrash} tone="text-rose-700" />
        <StatCard label="ปัญหาข้อมูล" value={summary.openIssues} tone="text-amber-700" />
        <StatCard label="วันพิเศษ" value={state.calendarRules.length} tone="text-teal-700" />
        <StatCard label="template" value={state.templates.length} tone="text-slate-950" />
      </section>

      <section className="app-content-grid xl:grid-cols-[1.05fr_0.95fr]">
        <div className="app-panel-pad">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <span className="nexus-kicker">
                <UploadCloud size={16} aria-hidden="true" />
                Import Safety
              </span>
              <h2 className="mt-3 text-2xl font-black text-slate-950">ตรวจไฟล์ก่อนนำเข้า ไม่ให้ข้อมูลซ้ำหรือผิดห้อง</h2>
              <p className="mt-2 text-sm font-bold leading-6 text-slate-600">{state.lastImportAction}</p>
            </div>
            <button className="amber-action inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black" onClick={runImportSafetyCheck} type="button">
              <ClipboardCheck size={17} aria-hidden="true" />
              ตรวจไฟล์นำเข้า
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {[
              'Preview ก่อน import จริงทุกครั้ง',
              'ตรวจรหัสซ้ำ ชื่อซ้ำ และชื่อว่าง',
              'ตรวจ classroom_id / academic_year',
              'เก็บ import batch เพื่อลบรอบล่าสุดได้',
              'แยกแถวผ่านและแถวต้องแก้',
              'บันทึก audit ว่าใครนำเข้าไฟล์ไหน',
            ].map((item) => (
              <div className="rounded-2xl border border-[#ead8bd] bg-white/80 p-3 text-sm font-black text-slate-700" key={item}>
                <CheckCircle2 className="mr-2 inline text-teal-600" size={16} aria-hidden="true" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="app-panel-pad">
          <span className="nexus-kicker">
            <SlidersHorizontal size={16} aria-hidden="true" />
            Simple / Advanced
          </span>
          <h2 className="mt-3 text-2xl font-black text-slate-950">โหมดใช้งานตามความถนัดของครู</h2>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
            Simple Mode ซ่อนรายละเอียดเชิงระบบ เหลือเฉพาะงานที่ครูใช้บ่อย ส่วน Advanced Mode เปิดเครื่องมือจัดการและตรวจสอบครบ
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {(['simple', 'advanced'] as UiMode[]).map((mode) => (
              <button
                className={`min-h-20 rounded-2xl border px-4 text-left text-sm font-black transition ${
                  state.mode === mode
                    ? 'border-[#d89333] bg-[#fff1c9] text-[#3a2817] shadow-[0_16px_34px_rgba(188,117,32,0.16)]'
                    : 'border-[#ead8bd] bg-white/80 text-slate-600 hover:bg-white'
                }`}
                key={mode}
                onClick={() => setState((current) => ({ ...current, mode }))}
                type="button"
              >
                <span className="block text-lg">{mode === 'simple' ? 'Simple Mode' : 'Advanced Mode'}</span>
                <span className="mt-1 block text-xs leading-5">
                  {mode === 'simple' ? 'งานหลัก กระชับ เหมาะกับครูทั่วไป' : 'เห็นเครื่องมือจัดการ ตรวจสอบ และ debug'}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="app-content-grid xl:grid-cols-[0.9fr_1.1fr]">
        <div className="app-panel-pad">
          <span className="nexus-kicker">
            <Trash2 size={16} aria-hidden="true" />
            Trash & Restore
          </span>
          <h2 className="mt-3 text-2xl font-black text-slate-950">ถังขยะและกู้คืนข้อมูล</h2>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
            ป้องกันปัญหาลบแล้วหายทันทีหรือกู้คืนไม่ได้ โดยแยกกู้คืนกับลบถาวรชัดเจน
          </p>

          <div className="mt-5 grid gap-3">
            {state.trashItems
              .filter((item) => !item.permanentlyDeleted)
              .map((item) => (
                <div className={`rounded-2xl border p-4 ${item.restored ? 'border-teal-200 bg-teal-50' : 'border-[#ead8bd] bg-white/80'}`} key={item.id}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.12em] text-cyan-700">
                        {trashKindLabels[item.kind]} {item.restored ? '| กู้คืนแล้ว' : ''}
                      </p>
                      <h3 className="mt-1 text-lg font-black text-slate-950">{item.title}</h3>
                      <p className="mt-1 text-xs font-bold leading-5 text-slate-500">{item.detail}</p>
                      <p className="mt-2 text-xs font-bold text-slate-400">
                        ลบโดย {item.deletedBy} | {item.deletedAt}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#ead8bd] bg-white px-3 text-xs font-black text-[#3a2817] disabled:opacity-40"
                        disabled={item.restored}
                        onClick={() => restoreTrash(item.id)}
                        type="button"
                      >
                        <RotateCcw size={15} aria-hidden="true" />
                        กู้คืน
                      </button>
                      <button
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-black text-rose-700"
                        onClick={() => deleteTrashForever(item.id)}
                        type="button"
                      >
                        <Trash2 size={15} aria-hidden="true" />
                        ลบถาวร
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div className="app-panel-pad">
          <span className="nexus-kicker">
            <ShieldCheck size={16} aria-hidden="true" />
            Data Health
          </span>
          <h2 className="mt-3 text-2xl font-black text-slate-950">ตรวจสุขภาพข้อมูลที่ทำให้ระบบไม่โผล่หรือรายงานผิด</h2>
          <div className="mt-5 grid gap-3">
            {state.healthIssues.map((issue) => (
              <div className={`rounded-2xl border p-4 ${issue.resolved ? 'border-teal-200 bg-teal-50 text-teal-700' : healthStyles[issue.severity]}`} key={issue.id}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.12em]">
                      {issue.resolved ? 'resolved' : issue.severity}
                    </p>
                    <h3 className="mt-1 text-lg font-black">{issue.title}</h3>
                    <p className="mt-1 text-sm font-bold leading-6">{issue.detail}</p>
                  </div>
                  <button
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-black text-slate-700 shadow-sm ring-1 ring-black/5 disabled:opacity-40"
                    disabled={issue.resolved}
                    onClick={() => resolveHealthIssue(issue.id)}
                    type="button"
                  >
                    <CheckCircle2 size={15} aria-hidden="true" />
                    {issue.action}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="app-content-grid xl:grid-cols-2">
        <div className="app-panel-pad">
          <span className="nexus-kicker">
            <CalendarDays size={16} aria-hidden="true" />
            School Calendar
          </span>
          <h2 className="mt-3 text-2xl font-black text-slate-950">ปฏิทินโรงเรียนสำหรับเช็คชื่อและรายงาน</h2>
          <div className="app-form-grid mt-5">
            <FieldLabel>
              วันที่
              <input className="nexus-field mt-2 h-12 px-4" type="date" value={calendarDraft.date} onChange={(event) => setCalendarDraft((current) => ({ ...current, date: event.target.value }))} />
            </FieldLabel>
            <FieldLabel>
              ประเภท
              <select className="nexus-field mt-2 h-12 px-4" value={calendarDraft.type} onChange={(event) => setCalendarDraft((current) => ({ ...current, type: event.target.value as CalendarRule['type'] }))}>
                <option value="activity">กิจกรรม</option>
                <option value="holiday">หยุดเรียน</option>
                <option value="exam">สอบ</option>
                <option value="makeup">เรียนชดเชย</option>
                <option value="custom">กำหนดเอง</option>
              </select>
            </FieldLabel>
            <FieldLabel>
              นโยบายเช็คชื่อ
              <select className="nexus-field mt-2 h-12 px-4" value={calendarDraft.attendancePolicy} onChange={(event) => setCalendarDraft((current) => ({ ...current, attendancePolicy: event.target.value as CalendarRule['attendancePolicy'] }))}>
                <option value="normal">เช็คชื่อปกติ</option>
                <option value="warn">เตือนก่อนบันทึก</option>
                <option value="skip">ไม่คิดเป็นวันเรียน</option>
              </select>
            </FieldLabel>
            <FieldLabel>
              ชื่อวันพิเศษ
              <input className="nexus-field mt-2 h-12 px-4" placeholder="เช่น สอบกลางภาค / ทัศนศึกษา" value={calendarDraft.title} onChange={(event) => setCalendarDraft((current) => ({ ...current, title: event.target.value }))} />
            </FieldLabel>
          </div>
          <button className="amber-action mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black" onClick={addCalendarRule} type="button">
            <CalendarDays size={17} aria-hidden="true" />
            บันทึกวันพิเศษ
          </button>
          <div className="mt-5 grid gap-2">
            {state.calendarRules.map((rule) => (
              <div className="flex items-center justify-between rounded-2xl border border-[#ead8bd] bg-white/80 p-3 text-sm font-black text-slate-700" key={rule.id}>
                <span>{rule.date} | {rule.title}</span>
                <span className="rounded-full bg-[#fff1c9] px-3 py-1 text-xs text-[#8a5200]">{rule.attendancePolicy}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="app-panel-pad">
          <span className="nexus-kicker">
            <MessageSquareText size={16} aria-hidden="true" />
            Parent Message Templates
          </span>
          <h2 className="mt-3 text-2xl font-black text-slate-950">ข้อความสำเร็จรูปสำหรับครู</h2>
          <div className="app-form-grid mt-5">
            <FieldLabel>
              หมวด
              <input className="nexus-field mt-2 h-12 px-4" value={templateDraft.category} onChange={(event) => setTemplateDraft((current) => ({ ...current, category: event.target.value }))} />
            </FieldLabel>
            <FieldLabel>
              ชื่อ template
              <input className="nexus-field mt-2 h-12 px-4" placeholder="เช่น แจ้งขาดเรียน" value={templateDraft.title} onChange={(event) => setTemplateDraft((current) => ({ ...current, title: event.target.value }))} />
            </FieldLabel>
          </div>
          <FieldLabel>
            ข้อความ
            <textarea className="nexus-field mt-2 min-h-32 px-4 py-3" value={templateDraft.body} onChange={(event) => setTemplateDraft((current) => ({ ...current, body: event.target.value }))} />
          </FieldLabel>
          <button className="dark-action mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black" onClick={addTemplate} type="button">
            <MessageSquareText size={17} aria-hidden="true" />
            บันทึก template
          </button>
          <div className="mt-5 grid gap-3">
            {state.templates.map((template) => (
              <div className="rounded-2xl border border-[#ead8bd] bg-white/85 p-4" key={template.id}>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-cyan-700">{template.category}</p>
                <h3 className="mt-1 text-lg font-black text-slate-950">{template.title}</h3>
                <p className="mt-2 text-sm font-bold leading-6 text-slate-600">{template.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="nexus-card mt-5 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="nexus-kicker">
              <FileWarning size={16} aria-hidden="true" />
              Implementation note
            </span>
            <h2 className="mt-3 text-2xl font-black text-slate-950">สิ่งที่หน้านี้กันปัญหาให้ระบบ</h2>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
              import ผิด, ข้อมูลซ้ำ, ลบผิด, นักเรียนไม่โผล่, รายงานไม่ตรงวันเรียน และครูหาเมนูไม่เจอ
              ถูกจัดเป็น workflow เดียว ก่อนต่อ backend table/RPC จริงใน Supabase
            </p>
          </div>
          <button
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#ead8bd] bg-white px-5 text-sm font-black text-slate-700"
            onClick={() => setState(createDefaultState(session))}
            type="button"
          >
            <RefreshCw size={17} aria-hidden="true" />
            รีเซ็ตข้อมูลตัวอย่าง
          </button>
        </div>
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-800">
          <AlertTriangle className="mr-2 inline" size={16} aria-hidden="true" />
          ตอนนี้ action ในหน้านี้เป็น local-first เพื่อออกแบบ flow ให้ครบและทดลองได้ทันที ขั้นถัดไปคือผูกกับ Supabase tables/RPC:
          import_jobs, trash_items, data_health_issues, school_calendar_days และ message_templates
        </div>
      </section>
    </main>
  );
}
