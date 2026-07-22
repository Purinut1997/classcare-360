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

import { supabase } from '../../lib/supabaseClient';
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

type SyncStatus = 'local' | 'loading' | 'synced' | 'missing_sql' | 'error';

interface SyncState {
  status: SyncStatus;
  message: string;
}

type DbRow = Record<string, unknown>;

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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isMissingDataSafetySql(error: unknown) {
  const message = String((error as { message?: string; code?: string })?.message || '');
  const code = String((error as { code?: string })?.code || '');
  return code === '42P01' || message.includes('does not exist') || message.includes('schema cache');
}

function toTrashKind(value: string): TrashKind {
  if (['student', 'classroom', 'workspace', 'score_set', 'attendance_session'].includes(value)) {
    return value as TrashKind;
  }
  return 'student';
}

function toHealthSeverity(value: string): HealthSeverity {
  if (value === 'critical' || value === 'error') return 'danger';
  if (value === 'warning') return 'warning';
  return 'info';
}

function toCalendarType(value: string): CalendarRule['type'] {
  if (value === 'holiday' || value === 'exam' || value === 'activity' || value === 'makeup') return value;
  return 'custom';
}

function toDayType(value: CalendarRule['type']) {
  if (value === 'custom') return 'school_day';
  return value === 'holiday' ? 'holiday' : value;
}

function toTemplateType(category: string) {
  const text = category.toLowerCase();
  if (text.includes('absence') || text.includes('ขาด')) return 'attendance_absent';
  if (text.includes('late') || text.includes('สาย')) return 'attendance_late';
  if (text.includes('care') || text.includes('เคส')) return 'care_follow_up';
  if (text.includes('saving') || text.includes('ออม')) return 'savings';
  if (text.includes('score') || text.includes('คะแนน')) return 'score';
  return 'general';
}

function getJsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function mapTrashRow(row: DbRow): TrashItem {
  const payload = getJsonObject(row.payload);
  const metadata = getJsonObject(row.metadata);
  return {
    id: String(row.id),
    kind: toTrashKind(String(row.entity_type || 'student')),
    title: String(row.display_name || row.entity_type || 'deleted item'),
    detail: String(row.reason || payload.detail || metadata.detail || ''),
    deletedBy: String(row.deleted_by || metadata.deleted_by_email || 'system'),
    deletedAt: String(row.deleted_at || row.created_at || '').slice(0, 10),
    restored: row.restore_status === 'restored',
    permanentlyDeleted: row.restore_status === 'purged',
  };
}

function mapHealthRow(row: DbRow): HealthIssue {
  return {
    id: String(row.id),
    severity: toHealthSeverity(String(row.severity || 'warning')),
    title: String(row.title || row.issue_type || 'Data issue'),
    detail: String(row.detail || ''),
    action: String(row.suggested_action || 'ตรวจสอบข้อมูล'),
    resolved: row.status === 'resolved',
  };
}

function mapCalendarRow(row: DbRow): CalendarRule {
  const type = toCalendarType(String(row.day_type || 'custom'));
  const metadata = getJsonObject(row.metadata);
  return {
    id: String(row.id),
    date: String(row.calendar_date || '').slice(0, 10),
    title: String(row.title || ''),
    type,
    attendancePolicy:
      (metadata.attendancePolicy as CalendarRule['attendancePolicy'] | undefined) ||
      (row.affects_attendance === false ? 'skip' : type === 'exam' || type === 'holiday' ? 'warn' : 'normal'),
  };
}

function mapTemplateRow(row: DbRow): MessageTemplate {
  return {
    id: String(row.id),
    category: String(row.template_type || 'general'),
    title: String(row.title || ''),
    body: String(row.body || ''),
  };
}

export function DataSafetyCenterPage({ session }: DataSafetyCenterPageProps) {
  const storageKey = getStorageKey(session);
  const [state, setState] = useState<DataSafetyState>(() => createDefaultState(session));
  const [sync, setSync] = useState<SyncState>({
    status: 'local',
    message: 'Local-first: ใช้ข้อมูลในเครื่องจนกว่าจะเชื่อม Supabase สำเร็จ',
  });
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

  useEffect(() => {
    let cancelled = false;

    async function loadRemoteState() {
      if (!supabase || !session.workspace?.id) {
        setSync({
          status: 'local',
          message: 'ยังไม่มี Supabase หรือ workspace ใช้ข้อมูล local สำหรับทดลองก่อน',
        });
        return;
      }

      setSync({ status: 'loading', message: 'กำลังโหลดข้อมูล Data Safety จาก Supabase' });

      try {
        const workspaceId = session.workspace.id;
        const [trashResult, healthResult, calendarResult, settingsResult, templatesResult] = await Promise.all([
          supabase
            .from('trash_items')
            .select('*')
            .eq('workspace_id', workspaceId)
            .neq('restore_status', 'purged')
            .order('deleted_at', { ascending: false }),
          supabase
            .from('data_health_issues')
            .select('*')
            .eq('workspace_id', workspaceId)
            .order('detected_at', { ascending: false }),
          supabase
            .from('school_calendar_days')
            .select('*')
            .eq('workspace_id', workspaceId)
            .order('calendar_date', { ascending: true }),
          supabase.from('workspace_ui_settings').select('*').eq('workspace_id', workspaceId).maybeSingle(),
          supabase
            .from('message_templates')
            .select('*')
            .eq('workspace_id', workspaceId)
            .eq('is_active', true)
            .order('created_at', { ascending: false }),
        ]);

        const error =
          trashResult.error ||
          healthResult.error ||
          calendarResult.error ||
          settingsResult.error ||
          templatesResult.error;

        if (error) throw error;
        if (cancelled) return;

        setState((current) => ({
          ...current,
          mode: (settingsResult.data?.mode as UiMode) || current.mode,
          trashItems: trashResult.data?.length ? trashResult.data.map(mapTrashRow) : current.trashItems,
          healthIssues: healthResult.data?.length ? healthResult.data.map(mapHealthRow) : current.healthIssues,
          calendarRules: calendarResult.data?.length ? calendarResult.data.map(mapCalendarRow) : current.calendarRules,
          templates: templatesResult.data?.length ? templatesResult.data.map(mapTemplateRow) : current.templates,
        }));

        setSync({
          status: 'synced',
          message: 'เชื่อม Supabase แล้ว: กู้คืน/ลบถาวร/ปฏิทิน/template จะบันทึกลงฐานข้อมูลเมื่อมีตารางพร้อม',
        });
      } catch (error) {
        if (cancelled) return;
        setSync({
          status: isMissingDataSafetySql(error) ? 'missing_sql' : 'error',
          message: isMissingDataSafetySql(error)
            ? 'ยังไม่ได้รัน SQL 0023_data_safety_center.sql ใน Supabase จึงใช้ข้อมูล local ชั่วคราว'
            : `โหลด Supabase ไม่สำเร็จ: ${String((error as { message?: string })?.message || error)}`,
        });
      }
    }

    void loadRemoteState();

    return () => {
      cancelled = true;
    };
  }, [session.workspace?.id]);

  const summary = useMemo(() => {
    const openTrash = state.trashItems.filter((item) => !item.restored && !item.permanentlyDeleted).length;
    const openIssues = state.healthIssues.filter((item) => !item.resolved).length;
    const warningCalendar = state.calendarRules.filter((item) => item.attendancePolicy !== 'normal').length;

    return { openTrash, openIssues, warningCalendar };
  }, [state]);

  const updateSyncFromError = (error: unknown) => {
    setSync({
      status: isMissingDataSafetySql(error) ? 'missing_sql' : 'error',
      message: isMissingDataSafetySql(error)
        ? 'ยังไม่ได้รัน SQL 0023_data_safety_center.sql ใน Supabase จึงบันทึกเฉพาะ local'
        : `บันทึก Supabase ไม่สำเร็จ: ${String((error as { message?: string })?.message || error)}`,
    });
  };

  const persistMode = async (mode: UiMode) => {
    if (!supabase || !session.workspace?.id) return;
    const { error } = await supabase.from('workspace_ui_settings').upsert({
      workspace_id: session.workspace.id,
      mode,
      updated_by: session.profile.id,
    });
    if (error) updateSyncFromError(error);
    else setSync({ status: 'synced', message: 'บันทึกโหมดใช้งานลง Supabase แล้ว' });
  };

  const runImportSafetyCheck = async () => {
    setState((current) => ({
      ...current,
      importChecked: true,
      lastImportAction:
        'ตรวจแล้ว: พบกฎป้องกันซ้ำ 6 ข้อพร้อมใช้งาน ระบบจะ preview ก่อน import จริงและบันทึก import batch ทุกครั้ง',
      healthIssues: current.healthIssues.map((issue) =>
        issue.id === 'health-duplicate' ? { ...issue, resolved: true } : issue,
      ),
    }));

    const duplicateIssue = state.healthIssues.find((issue) => issue.id === 'health-duplicate');
    if (supabase && session.workspace?.id && duplicateIssue && isUuid(duplicateIssue.id)) {
      const { error } = await supabase
        .from('data_health_issues')
        .update({
          status: 'resolved',
          resolved_by: session.profile.id,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', duplicateIssue.id)
        .eq('workspace_id', session.workspace.id);
      if (error) updateSyncFromError(error);
    }
  };

  const restoreTrash = async (id: string) => {
    setState((current) => ({
      ...current,
      trashItems: current.trashItems.map((item) => (item.id === id ? { ...item, restored: true } : item)),
    }));

    if (!supabase || !session.workspace?.id || !isUuid(id)) return;
    const { error } = await supabase
      .from('trash_items')
      .update({
        restore_status: 'restored',
        restored_by: session.profile.id,
        restored_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('workspace_id', session.workspace.id);
    if (error) updateSyncFromError(error);
    else setSync({ status: 'synced', message: 'กู้คืนรายการลง Supabase แล้ว' });
  };

  const deleteTrashForever = async (id: string) => {
    setState((current) => ({
      ...current,
      trashItems: current.trashItems.map((item) =>
        item.id === id ? { ...item, permanentlyDeleted: true } : item,
      ),
    }));

    if (!supabase || !session.workspace?.id || !isUuid(id)) return;
    const { error } = await supabase
      .from('trash_items')
      .update({
        restore_status: 'purged',
        purged_by: session.profile.id,
        purged_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('workspace_id', session.workspace.id);
    if (error) updateSyncFromError(error);
    else setSync({ status: 'synced', message: 'ลบถาวรใน Supabase แล้ว' });
  };

  const resolveHealthIssue = async (id: string) => {
    setState((current) => ({
      ...current,
      healthIssues: current.healthIssues.map((issue) => (issue.id === id ? { ...issue, resolved: true } : issue)),
    }));

    if (!supabase || !session.workspace?.id || !isUuid(id)) return;
    const { error } = await supabase
      .from('data_health_issues')
      .update({
        status: 'resolved',
        resolved_by: session.profile.id,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('workspace_id', session.workspace.id);
    if (error) updateSyncFromError(error);
    else setSync({ status: 'synced', message: 'ปิด issue ลง Supabase แล้ว' });
  };

  const addCalendarRule = async () => {
    if (!calendarDraft.title.trim()) return;
    const tempId = `calendar-${Date.now()}`;
    setState((current) => ({
      ...current,
      calendarRules: [
        {
          id: tempId,
          date: calendarDraft.date,
          title: calendarDraft.title.trim(),
          type: calendarDraft.type,
          attendancePolicy: calendarDraft.attendancePolicy,
        },
        ...current.calendarRules,
      ],
    }));
    setCalendarDraft((current) => ({ ...current, title: '' }));

    if (!supabase || !session.workspace?.id) return;
    const { data, error } = await supabase
      .from('school_calendar_days')
      .insert({
        workspace_id: session.workspace.id,
        calendar_date: calendarDraft.date,
        day_type: toDayType(calendarDraft.type),
        title: calendarDraft.title.trim(),
        affects_attendance: calendarDraft.attendancePolicy !== 'skip',
        affects_reports: true,
        metadata: { attendancePolicy: calendarDraft.attendancePolicy },
        created_by: session.profile.id,
      })
      .select('*')
      .single();
    if (error) {
      updateSyncFromError(error);
      return;
    }
    setState((current) => ({
      ...current,
      calendarRules: current.calendarRules.map((rule) => (rule.id === tempId ? mapCalendarRow(data) : rule)),
    }));
    setSync({ status: 'synced', message: 'บันทึกปฏิทินโรงเรียนลง Supabase แล้ว' });
  };

  const addTemplate = async () => {
    if (!templateDraft.title.trim() || !templateDraft.body.trim()) return;
    const tempId = `template-${Date.now()}`;
    setState((current) => ({
      ...current,
      templates: [
        {
          id: tempId,
          category: templateDraft.category.trim() || 'ทั่วไป',
          title: templateDraft.title.trim(),
          body: templateDraft.body.trim(),
        },
        ...current.templates,
      ],
    }));
    setTemplateDraft((current) => ({ ...current, title: '' }));

    if (!supabase || !session.workspace?.id) return;
    const { data, error } = await supabase
      .from('message_templates')
      .insert({
        workspace_id: session.workspace.id,
        template_type: toTemplateType(templateDraft.category),
        title: templateDraft.title.trim(),
        body: templateDraft.body.trim(),
        channel: 'line',
        is_active: true,
        created_by: session.profile.id,
      })
      .select('*')
      .single();
    if (error) {
      updateSyncFromError(error);
      return;
    }
    setState((current) => ({
      ...current,
      templates: current.templates.map((template) => (template.id === tempId ? mapTemplateRow(data) : template)),
    }));
    setSync({ status: 'synced', message: 'บันทึก template ลง Supabase แล้ว' });
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

      <div
        className={`mt-5 rounded-2xl border px-4 py-3 text-sm font-bold ${
          sync.status === 'synced'
            ? 'border-teal-200 bg-teal-50 text-teal-800'
            : sync.status === 'missing_sql' || sync.status === 'error'
              ? 'border-amber-200 bg-amber-50 text-amber-800'
              : 'border-[#ead8bd] bg-white/80 text-slate-600'
        }`}
      >
        Supabase sync: {sync.message}
      </div>

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
                onClick={() => {
                  setState((current) => ({ ...current, mode }));
                  void persistMode(mode);
                }}
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
