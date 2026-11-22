import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  DatabaseZap,
  Download,
  FileCheck2,
  FileUp,
  MessageSquareText,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wrench,
} from 'lucide-react';
import { ContextLink as Link } from '../../components/navigation/ContextLink';
import { NexusAuroraInline } from '../../components/system/NexusAuroraLoader';
import { isDemoSession } from '../../lib/auth';
import { canManageWorkspace } from '../../lib/roles';
import { supabase } from '../../lib/supabaseClient';
import type { AppSessionContext } from '../../types/core';

interface DataSafetyCenterPageProps {
  session: AppSessionContext;
}

type SafetyTab = 'backup' | 'health' | 'trash' | 'templates';
type TrashKind = 'student' | 'classroom' | 'workspace' | 'score_set' | 'attendance_session';
type HealthSeverity = 'danger' | 'warning' | 'info';

interface TrashItem {
  id: string;
  kind: TrashKind;
  title: string;
  detail: string;
  deletedAt: string;
  restored: boolean;
  payload: Record<string, unknown>;
}

interface LiveHealthIssue {
  id: string;
  severity: HealthSeverity;
  title: string;
  detail: string;
  count?: number;
  fixType?: 'assign_classroom' | 'repair_savings' | 'link';
  linkTo?: string;
  linkLabel?: string;
  payload?: unknown;
}

interface MessageTemplate {
  id: string;
  templateType: string;
  title: string;
  body: string;
  channel: string;
}

interface BackupPreview {
  fileName: string;
  exportedAt: string | null;
  schoolName: string;
  classrooms: Array<Record<string, unknown>>;
  students: Array<Record<string, unknown>>;
  savingsAccountsCount: number;
  savingsTxCount: number;
  attendanceCount: number;
  scoresCount: number;
  behaviorCount: number;
  healthCount: number;
  desirableCount: number;
  templates: Array<Record<string, unknown>>;
  raw: Record<string, unknown>;
}

interface WorkspaceStats {
  classrooms: number;
  students: number;
  savingsAccounts: number;
  savingsTransactions: number;
  lastBackupAt: string | null;
}

const trashKindLabels: Record<TrashKind, string> = {
  student: 'นักเรียน',
  classroom: 'ห้องเรียน',
  workspace: 'พื้นที่ทำงาน',
  score_set: 'ชุดคะแนน',
  attendance_session: 'รอบเช็คชื่อ',
};

const templateTypeLabels: Record<string, string> = {
  attendance_absent: 'แจ้งขาดเรียน',
  attendance_late: 'แจ้งมาสาย',
  care_follow_up: 'ติดตามดูแลนักเรียน',
  savings: 'เงินออมนักเรียน',
  score: 'ผลการเรียน/คะแนน',
  general: 'ประกาศทั่วไป',
};

const DEFAULT_STARTER_TEMPLATES = [
  {
    template_type: 'attendance_absent',
    title: 'แจ้งผู้ปกครองกรณีนักเรียนขาดเรียน',
    body: 'เรียนผู้ปกครองของ {{student_name}} วันนี้ไม่พบนักเรียนมาเรียน หากมีเหตุจำเป็นหรือใบลา กรุณาแจ้งครูประจำชั้นด้วยครับ/ค่ะ',
    channel: 'line',
  },
  {
    template_type: 'savings',
    title: 'สรุปยอดเงินออมประจำเดือน',
    body: 'เรียนผู้ปกครองของ {{student_name}} แจ้งยอดเงินออมสะสมคงเหลือล่าสุด {{balance}} บาท ขอบคุณที่ร่วมส่งเสริมวินัยการออมครับ/ค่ะ',
    channel: 'line',
  },
  {
    template_type: 'care_follow_up',
    title: 'นัดหมายเยี่ยมบ้าน / ติดตามดูแลนักเรียน',
    body: 'เรียนผู้ปกครองของ {{student_name}} ครูประจำชั้นขออนุญาตประสานงานพูดคุยและติดตามการเรียนของนักเรียน เพื่อร่วมกันดูแลอย่างใกล้ชิดครับ/ค่ะ',
    channel: 'line',
  },
];

function formatThaiDateTime(value?: string | null) {
  if (!value) return 'ยังไม่เคยสำรอง';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(d);
}

function toTrashKind(value: string): TrashKind {
  if (['student', 'classroom', 'workspace', 'score_set', 'attendance_session'].includes(value)) {
    return value as TrashKind;
  }
  return 'student';
}

function triggerJsonDownload(payload: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function DataSafetyCenterPage({ session }: DataSafetyCenterPageProps) {
  const demoMode = isDemoSession(session);
  const canManageSafety = canManageWorkspace(session.profile.role);
  const workspaceId = session.workspace?.id || '';
  const schoolName = session.workspace?.schoolName || session.workspace?.name || 'โรงเรียนของฉัน';

  const [activeTab, setActiveTab] = useState<SafetyTab>('backup');
  const [isLoading, setIsLoading] = useState(Boolean(supabase && workspaceId && !demoMode));
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Live data states (ZERO hardcoded fake demo items on real workspaces!)
  const [stats, setStats] = useState<WorkspaceStats>({
    classrooms: 0,
    students: 0,
    savingsAccounts: 0,
    savingsTransactions: 0,
    lastBackupAt: null,
  });
  const [primaryClassroomId, setPrimaryClassroomId] = useState<string | null>(null);
  const [healthIssues, setHealthIssues] = useState<LiveHealthIssue[]>([]);
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);

  // Backup / Restore states
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoringFile, setIsRestoringFile] = useState(false);
  const [backupPreview, setBackupPreview] = useState<BackupPreview | null>(null);
  const [backupFileError, setBackupFileError] = useState<string | null>(null);

  // Action busy flags
  const [fixingIssueId, setFixingIssueId] = useState<string | null>(null);
  const [busyTrashId, setBusyTrashId] = useState<string | null>(null);
  const [isBulkTrashBusy, setIsBulkTrashBusy] = useState(false);
  const [trashSearch, setTrashSearch] = useState('');
  const [trashKindFilter, setTrashKindFilter] = useState<'all' | 'student' | 'classroom' | 'other'>('all');
  const [trashPage, setTrashPage] = useState(1);
  const [selectedTrashIds, setSelectedTrashIds] = useState<string[]>([]);
  const TRASH_PAGE_SIZE = 10;
  const [copiedTplId, setCopiedTplId] = useState<string | null>(null);
  const [isSavingTpl, setIsSavingTpl] = useState(false);
  const [templateDraft, setTemplateDraft] = useState({
    templateType: 'general',
    title: '',
    body: 'เรียนผู้ปกครองของ {{student_name}} ',
  });

  const loadLiveSafetyData = useCallback(async () => {
    if (!supabase || !workspaceId || demoMode) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [
        wsRes,
        classroomsRes,
        studentsRes,
        savingsAccRes,
        savingsTxRes,
        trashRes,
        templatesRes,
        lastBackupRes,
      ] = await Promise.all([
        supabase.from('workspaces').select('id,name,school_name,academic_year,settings').eq('id', workspaceId).maybeSingle(),
        supabase.from('classrooms').select('id,name,academic_year').eq('workspace_id', workspaceId).order('created_at', { ascending: true }),
        supabase
          .from('students')
          .select('id,classroom_id,student_code,first_name,last_name,status')
          .eq('workspace_id', workspaceId)
          .neq('status', 'deleted')
          .limit(2000),
        supabase.from('savings_accounts').select('id,student_id,balance,metadata').eq('workspace_id', workspaceId).limit(2000),
        supabase
          .from('savings_transactions')
          .select('id,student_id,transaction_type,amount,note,metadata,created_at')
          .eq('workspace_id', workspaceId)
          .limit(5000),
        supabase
          .from('trash_items')
          .select('id,entity_type,display_name,reason,payload,restore_status,deleted_at,created_at')
          .eq('workspace_id', workspaceId)
          .neq('restore_status', 'purged')
          .order('deleted_at', { ascending: false })
          .limit(300),
        supabase
          .from('message_templates')
          .select('id,template_type,title,body,channel')
          .eq('workspace_id', workspaceId)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('audit_logs')
          .select('created_at')
          .eq('workspace_id', workspaceId)
          .in('action', ['workspace_backup_exported', 'superadmin_workspace_snapshot_exported'])
          .order('created_at', { ascending: false })
          .limit(1),
      ]);

      const classrooms = (classroomsRes.data || []) as Array<{ id: string; name: string; academic_year: string | null }>;
      const students = (studentsRes.data || []) as Array<{
        id: string;
        classroom_id: string | null;
        student_code: string | null;
        first_name: string | null;
        last_name: string | null;
        status: string | null;
      }>;
      const savingsAccounts = (savingsAccRes.data || []) as Array<{
        id: string;
        student_id: string;
        balance: number | null;
        metadata: Record<string, unknown> | null;
      }>;
      const savingsTxs = (savingsTxRes.data || []) as Array<{
        id: string;
        student_id: string;
        transaction_type: string;
        amount: number | null;
        note: string | null;
        metadata: Record<string, unknown> | null;
        created_at: string | null;
      }>;

      setPrimaryClassroomId(classrooms[0]?.id || null);
      setStats({
        classrooms: classrooms.length,
        students: students.length,
        savingsAccounts: savingsAccounts.length,
        savingsTransactions: savingsTxs.length,
        lastBackupAt: (lastBackupRes.data?.[0]?.created_at as string | undefined) || null,
      });

      // Map real Trash items
      const mappedTrash: TrashItem[] = ((trashRes.data || []) as Array<Record<string, unknown>>).map((row) => ({
        id: String(row.id),
        kind: toTrashKind(String(row.entity_type || 'student')),
        title: String(row.display_name || row.entity_type || 'รายการที่ลบ'),
        detail: String(row.reason || ''),
        deletedAt: String(row.deleted_at || row.created_at || ''),
        restored: row.restore_status === 'restored',
        payload: (row.payload as Record<string, unknown>) || {},
      }));
      setTrashItems(mappedTrash);

      // Map real Message Templates
      const mappedTemplates: MessageTemplate[] = ((templatesRes.data || []) as Array<Record<string, unknown>>).map((row) => ({
        id: String(row.id),
        templateType: String(row.template_type || 'general'),
        title: String(row.title || ''),
        body: String(row.body || ''),
        channel: String(row.channel || 'line'),
      }));
      setTemplates(mappedTemplates);

      // --- LIVE DATA HEALTH SCANNER (100% REAL!) ---
      const issues: LiveHealthIssue[] = [];

      // 1. No classrooms yet
      if (classrooms.length === 0) {
        issues.push({
          id: 'no-classrooms',
          severity: 'warning',
          title: 'ยังไม่มีห้องเรียนในพื้นที่ทำงานนี้',
          detail: 'กรุณาสร้างห้องเรียนอย่างน้อย 1 ห้องก่อนเพิ่มนักเรียนและใช้งานระบบเช็กชื่อ/คะแนน/เงินออม',
          fixType: 'link',
          linkTo: '/app/dashboard?view=workspace-settings',
          linkLabel: 'ไปตั้งค่าห้องเรียน',
        });
      }

      // 2. No students yet
      if (students.length === 0) {
        issues.push({
          id: 'no-students',
          severity: 'info',
          title: 'ยังไม่มีรายชื่อนักเรียนในระบบ',
          detail: 'สามารถเพิ่มนักเรียนทีละคนหรือนำเข้าจากไฟล์ Excel / DMC ได้ทันที',
          fixType: 'link',
          linkTo: '/app/dashboard?view=import-export',
          linkLabel: 'ไปนำเข้ารายชื่อนักเรียน',
        });
      }

      // 3. Students without classroom_id
      const orphanStudents = students.filter((s) => !s.classroom_id);
      if (orphanStudents.length > 0) {
        const sampleNames = orphanStudents
          .slice(0, 3)
          .map((s) => `${s.first_name || ''} ${s.last_name || ''}`.trim())
          .join(', ');
        issues.push({
          id: 'orphan-students',
          severity: 'warning',
          title: `พบนักเรียนที่ยังไม่ผูกห้องเรียน ${orphanStudents.length} คน`,
          detail: `นักเรียนกลุ่มนี้ (${sampleNames}${orphanStudents.length > 3 ? ' ...' : ''}) จะไม่แสดงในหน้าเช็กชื่อ คะแนน และรายงาน`,
          count: orphanStudents.length,
          fixType: classrooms[0] ? 'assign_classroom' : 'link',
          linkTo: '/app/dashboard?view=students',
          linkLabel: classrooms[0] ? `ผูกเข้าห้อง ${classrooms[0].name} ทันที` : 'ไปกำหนดห้องเรียน',
          payload: orphanStudents.map((s) => s.id),
        });
      }

      // 4. Duplicate student_code or full name
      const codeCount = new Map<string, number>();
      const nameCount = new Map<string, number>();
      students.forEach((s) => {
        const code = (s.student_code || '').trim();
        if (code) codeCount.set(code, (codeCount.get(code) || 0) + 1);
        const fullName = `${(s.first_name || '').trim()} ${(s.last_name || '').trim()}`.trim();
        if (fullName) nameCount.set(fullName, (nameCount.get(fullName) || 0) + 1);
      });
      const dupCodes = [...codeCount.entries()].filter(([, c]) => c > 1).map(([k]) => k);
      const dupNames = [...nameCount.entries()].filter(([, c]) => c > 1).map(([k]) => k);
      if (dupCodes.length > 0 || dupNames.length > 0) {
        issues.push({
          id: 'duplicate-students',
          severity: 'danger',
          title: `พบรายชื่อหรือรหัสนักเรียนซ้ำ (${dupCodes.length + dupNames.length} จุด)`,
          detail: [
            dupCodes.length > 0 ? `รหัสซ้ำ: ${dupCodes.slice(0, 5).join(', ')}` : '',
            dupNames.length > 0 ? `ชื่อซ้ำ: ${dupNames.slice(0, 3).join(', ')}` : '',
          ]
            .filter(Boolean)
            .join(' · '),
          fixType: 'link',
          linkTo: '/app/dashboard?view=students',
          linkLabel: 'ไปจัดการรายชื่อนักเรียน',
        });
      }

      // 5. Savings ledger integrity check (account.balance vs opening + deposits - withdrawals)
      if (savingsAccounts.length > 0) {
        const mismatchedAccounts: Array<{ accountId: string; expectedBalance: number }> = [];
        savingsAccounts.forEach((acc) => {
          const studentTxs = savingsTxs.filter(
            (tx) =>
              tx.student_id === acc.student_id &&
              tx.metadata?.correction_role !== 'reversal' &&
              (!tx.metadata?.correction_id || !savingsTxs.some((t) => t.id === tx.metadata?.correction_id)),
          );
          let latestOpening = 0;
          let latestOpeningTime = '';
          let regularNet = 0;
          studentTxs.forEach((tx) => {
            const isOpening =
              tx.transaction_type === 'adjustment' ||
              Boolean(tx.metadata?.is_opening_balance) ||
              (typeof tx.note === 'string' && (tx.note.includes('ยอดยกมา') || tx.note.includes('เปิดบัญชีต้นงวด')));
            const amt = Number(tx.amount || 0);
            if (isOpening) {
              const t = tx.created_at || '';
              if (!latestOpeningTime || t.localeCompare(latestOpeningTime) > 0) {
                latestOpeningTime = t;
                latestOpening = amt;
              }
            } else {
              regularNet += tx.transaction_type === 'withdrawal' ? -amt : amt;
            }
          });
          const metaOpening = Number(acc.metadata?.opening_balance || 0);
          const opening = metaOpening > 0 ? metaOpening : latestOpening;
          const expectedBalance = Math.max(0, opening + regularNet);
          const actualBalance = Number(acc.balance || 0);
          if (Math.abs(expectedBalance - actualBalance) > 0.01) {
            mismatchedAccounts.push({ accountId: acc.id, expectedBalance });
          }
        });

        if (mismatchedAccounts.length > 0) {
          issues.push({
            id: 'savings-mismatch',
            severity: 'danger',
            title: `พบยอดบัญชีเงินออมไม่ตรงกับรายการฝาก-ถอน ${mismatchedAccounts.length} บัญชี`,
            detail: 'ยอดคงเหลือในบัญชีไม่ตรงกับผลรวมยอดยกมา + ฝาก - ถอน สามารถกดซ่อมแซมยอดให้อัตโนมัติได้ทันที',
            count: mismatchedAccounts.length,
            fixType: 'repair_savings',
            linkLabel: 'ซ่อมยอดเงินออมให้ตรงทันที',
            payload: mismatchedAccounts,
          });
        }
      }

      // 6. Report header / signer completeness check
      const wsSettings = (wsRes.data?.settings as Record<string, unknown> | null) || {};
      const reportIdentity = (wsSettings.report_identity as Record<string, unknown> | undefined) || {};
      const missingSigner =
        !wsRes.data?.school_name ||
        (!reportIdentity.directorName && !reportIdentity.teacherName);
      if (missingSigner) {
        issues.push({
          id: 'incomplete-report-header',
          severity: 'info',
          title: 'ยังตั้งค่าหัวรายงานและผู้ลงนามเอกสารไม่ครบ',
          detail: 'ควรระบุชื่อโรงเรียน ชื่อครูประจำชั้น และผู้อำนวยการ เพื่อให้รายงาน A4 และสมุด ปพ. พิมพ์ชื่อผู้ลงนามครบถ้วน',
          fixType: 'link',
          linkTo: '/app/dashboard?view=workspace-settings',
          linkLabel: 'ไปตั้งค่าโรงเรียน',
        });
      }

      setHealthIssues(issues);
    } catch (err) {
      setNotice({
        tone: 'error',
        text: `โหลดข้อมูลศูนย์ดูแลข้อมูลไม่สำเร็จ: ${err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'}`,
      });
    } finally {
      setIsLoading(false);
    }
  }, [demoMode, workspaceId]);

  useEffect(() => {
    void loadLiveSafetyData();
  }, [loadLiveSafetyData]);

  const activeTrashCount = useMemo(() => trashItems.filter((item) => !item.restored).length, [trashItems]);

  const filteredTrashItems = useMemo(() => {
    const q = trashSearch.trim().toLowerCase();
    return trashItems.filter((item) => {
      if (trashKindFilter === 'student' && item.kind !== 'student') return false;
      if (trashKindFilter === 'classroom' && item.kind !== 'classroom') return false;
      if (trashKindFilter === 'other' && (item.kind === 'student' || item.kind === 'classroom')) return false;
      if (!q) return true;
      return `${item.title} ${item.detail} ${trashKindLabels[item.kind]}`.toLowerCase().includes(q);
    });
  }, [trashItems, trashKindFilter, trashSearch]);

  useEffect(() => {
    setTrashPage(1);
  }, [trashSearch, trashKindFilter]);

  const trashTotalPages = Math.max(1, Math.ceil(filteredTrashItems.length / TRASH_PAGE_SIZE));
  const safeTrashPage = Math.min(trashPage, trashTotalPages);
  const paginatedTrashItems = useMemo(() => {
    const start = (safeTrashPage - 1) * TRASH_PAGE_SIZE;
    return filteredTrashItems.slice(start, start + TRASH_PAGE_SIZE);
  }, [filteredTrashItems, safeTrashPage]);

  const trashKindCounts = useMemo(() => {
    let student = 0;
    let classroom = 0;
    let other = 0;
    trashItems.forEach((item) => {
      if (item.kind === 'student') student += 1;
      else if (item.kind === 'classroom') classroom += 1;
      else other += 1;
    });
    return { all: trashItems.length, student, classroom, other };
  }, [trashItems]);

  // --- Action 1: REAL Full Workspace JSON Backup (v2 — all school modules scoped by workspace_id) ---
  async function safeFetchWorkspaceTable(tableName: string, rowLimit = 5000): Promise<Array<Record<string, unknown>>> {
    if (!supabase || !workspaceId) return [];
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('workspace_id', workspaceId)
        .limit(rowLimit);
      if (error) return [];
      return (data || []) as Array<Record<string, unknown>>;
    } catch {
      return [];
    }
  }

  async function handleExportBackup() {
    if (!supabase || !workspaceId || demoMode) {
      setNotice({ tone: 'info', text: 'โหมดตัวอย่าง: พร้อมสำรองข้อมูลจริงเมื่อใช้งานกับ Workspace จริง' });
      return;
    }

    setIsBackingUp(true);
    setNotice(null);
    try {
      const [
        wsRes,
        clsRows,
        stuRows,
        guardRows,
        savAccRows,
        savTxRows,
        calRows,
        tplRows,
        attSessionRows,
        attRecordRows,
        scoreAssessmentRows,
        scoreEntryRows,
        behaviorRows,
        healthRows,
        desirableRows,
        careCaseRows,
        homeVisitRows,
        scheduleRows,
        automationRuleRows,
        leaveRequestRows,
      ] = await Promise.all([
        supabase.from('workspaces').select('*').eq('id', workspaceId).maybeSingle(),
        safeFetchWorkspaceTable('classrooms', 500),
        safeFetchWorkspaceTable('students', 2000),
        safeFetchWorkspaceTable('student_guardians', 4000),
        safeFetchWorkspaceTable('savings_accounts', 2000),
        safeFetchWorkspaceTable('savings_transactions', 5000),
        safeFetchWorkspaceTable('school_calendar_days', 500),
        supabase.from('message_templates').select('*').eq('workspace_id', workspaceId).eq('is_active', true).limit(200).then((r) => (r.data || []) as Array<Record<string, unknown>>),
        safeFetchWorkspaceTable('attendance_sessions', 2000),
        safeFetchWorkspaceTable('attendance_records', 10000),
        safeFetchWorkspaceTable('score_assessments', 1000),
        safeFetchWorkspaceTable('score_entries', 10000),
        safeFetchWorkspaceTable('behavior_records', 5000),
        safeFetchWorkspaceTable('student_health_records', 5000),
        safeFetchWorkspaceTable('student_desirable_records', 2000),
        safeFetchWorkspaceTable('student_care_cases', 1000),
        safeFetchWorkspaceTable('student_home_visits', 1000),
        safeFetchWorkspaceTable('workspace_schedule_settings', 10),
        safeFetchWorkspaceTable('automation_rules', 100),
        safeFetchWorkspaceTable('student_leave_requests', 2000),
      ]);

      const snapshot = {
        schema_version: 'classcare-360-workspace-backup-v2',
        exported_at: new Date().toISOString(),
        exported_by: session.profile.email,
        workspace: wsRes.data || null,
        classrooms: clsRows,
        students: stuRows,
        student_guardians: guardRows,
        savings_accounts: savAccRows,
        savings_transactions: savTxRows,
        school_calendar_days: calRows,
        message_templates: tplRows,
        attendance_sessions: attSessionRows,
        attendance_records: attRecordRows,
        score_assessments: scoreAssessmentRows,
        score_entries: scoreEntryRows,
        behavior_records: behaviorRows,
        student_health_records: healthRows,
        student_desirable_records: desirableRows,
        student_care_cases: careCaseRows,
        student_home_visits: homeVisitRows,
        workspace_schedule_settings: scheduleRows,
        automation_rules: automationRuleRows,
        student_leave_requests: leaveRequestRows,
      };

      const safeSchool = schoolName.replace(/[^a-zA-Z0-9ก-๙_-]+/g, '_').slice(0, 40);
      const stamp = new Date().toISOString().slice(0, 10);
      triggerJsonDownload(snapshot, `classcare-backup-${safeSchool}-${stamp}.json`);

      // Record audit log for backup history
      await supabase.from('audit_logs').insert({
        workspace_id: workspaceId,
        actor_profile_id: session.profile.id,
        action: 'workspace_backup_exported',
        entity_table: 'workspaces',
        entity_id: workspaceId,
        risk_level: 'normal',
        metadata: {
          schema_version: snapshot.schema_version,
          classroom_count: snapshot.classrooms.length,
          student_count: snapshot.students.length,
          savings_tx_count: snapshot.savings_transactions.length,
          attendance_record_count: snapshot.attendance_records.length,
          score_entry_count: snapshot.score_entries.length,
          behavior_record_count: snapshot.behavior_records.length,
          health_record_count: snapshot.student_health_records.length,
          desirable_record_count: snapshot.student_desirable_records.length,
        },
      });

      setStats((prev) => ({ ...prev, lastBackupAt: new Date().toISOString() }));
      setNotice({
        tone: 'success',
        text: `✓ สำรองข้อมูลครบทุกโมดูลของ "${schoolName}" แล้ว (${snapshot.classrooms.length} ห้อง, ${snapshot.students.length} นักเรียน, ${snapshot.attendance_records.length} เช็กชื่อ, ${snapshot.score_entries.length} คะแนน, ${snapshot.savings_transactions.length} เงินออม)`,
      });
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof Error ? err.message : 'สำรองข้อมูลไม่สำเร็จ' });
    } finally {
      setIsBackingUp(false);
    }
  }

  // --- Action 2: Inspect & Safely Restore Backup JSON (supports both v1 & v2 snapshots) ---
  async function handleSelectBackupFile(file: File | null) {
    setBackupPreview(null);
    setBackupFileError(null);
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const target = Array.isArray(parsed.snapshots)
        ? ((parsed.snapshots[0] as Record<string, unknown>) || {})
        : parsed;

      if (!target.workspace && !Array.isArray(target.students) && !Array.isArray(target.classrooms)) {
        setBackupFileError('ไฟล์นี้ไม่ใช่ไฟล์สำรองข้อมูลของ ClassCare 360');
        return;
      }

      const wsObj = (target.workspace as Record<string, unknown> | undefined) || {};
      setBackupPreview({
        fileName: file.name,
        exportedAt: (target.exported_at as string | null) || (parsed.exported_at as string | null) || null,
        schoolName: String(wsObj.school_name || wsObj.name || 'ไม่ระบุชื่อโรงเรียน'),
        classrooms: Array.isArray(target.classrooms) ? (target.classrooms as Array<Record<string, unknown>>) : [],
        students: Array.isArray(target.students) ? (target.students as Array<Record<string, unknown>>) : [],
        savingsAccountsCount: Array.isArray(target.savings_accounts) ? target.savings_accounts.length : 0,
        savingsTxCount: Array.isArray(target.savings_transactions) ? target.savings_transactions.length : 0,
        attendanceCount: Array.isArray(target.attendance_records) ? target.attendance_records.length : 0,
        scoresCount: Array.isArray(target.score_entries) ? target.score_entries.length : 0,
        behaviorCount: Array.isArray(target.behavior_records) ? target.behavior_records.length : 0,
        healthCount: Array.isArray(target.student_health_records) ? target.student_health_records.length : 0,
        desirableCount: Array.isArray(target.student_desirable_records) ? target.student_desirable_records.length : 0,
        templates: Array.isArray(target.message_templates) ? (target.message_templates as Array<Record<string, unknown>>) : [],
        raw: target,
      });
    } catch {
      setBackupFileError('ไม่สามารถอ่านไฟล์ JSON ได้ กรุณาตรวจสอบว่าไฟล์ไม่เสียหาย');
    }
  }

  async function restoreMissingTableRows(
    tableName: string,
    rawRows: unknown,
    onConflict = 'id',
    transform?: (row: Record<string, unknown>) => Record<string, unknown> | null,
  ): Promise<number> {
    if (!supabase || !workspaceId || !Array.isArray(rawRows) || rawRows.length === 0) return 0;
    const prepared = rawRows
      .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === 'object'))
      .map((row) => (transform ? transform(row) : { ...row, workspace_id: workspaceId }))
      .filter((r): r is Record<string, unknown> => Boolean(r));
    if (prepared.length === 0) return 0;

    let restored = 0;
    for (let idx = 0; idx < prepared.length; idx += 300) {
      const chunk = prepared.slice(idx, idx + 300);
      const { error } = await supabase.from(tableName).upsert(chunk, { onConflict, ignoreDuplicates: true });
      if (!error) {
        restored += chunk.length;
      }
    }
    return restored;
  }

  async function handleSafeRestoreFromBackup() {
    if (!supabase || !workspaceId || !backupPreview || !canManageSafety) return;
    if (
      !window.confirm(
        `ยืนยันกู้คืนข้อมูลที่หายไปจากไฟล์ "${backupPreview.fileName}" เข้ามายัง "${schoolName}" หรือไม่?\n\nระบบจะกู้คืนห้องเรียน รายชื่อนักเรียน เวลาเรียน คะแนน พฤติกรรม สุขภาพ คุณลักษณะ ปฏิทิน ตารางสอน เงินออม และข้อความสำเร็จรูปที่หายไป (ไม่ลบหรือเขียนทับข้อมูลเดิมที่มีอยู่แล้ว)`,
      )
    ) {
      return;
    }

    setIsRestoringFile(true);
    setNotice(null);
    try {
      let restoredClassrooms = 0;
      let restoredStudents = 0;
      let restoredTemplates = 0;

      if (backupPreview.classrooms.length > 0) {
        const clsPayload = backupPreview.classrooms
          .filter((c) => c.id && c.name)
          .map((c) => ({
            id: String(c.id),
            workspace_id: workspaceId,
            name: String(c.name),
            grade_level: (c.grade_level as string | null) || null,
            academic_year: (c.academic_year as string | null) || null,
          }));
        if (clsPayload.length > 0) {
          const { error } = await supabase.from('classrooms').upsert(clsPayload, { onConflict: 'id', ignoreDuplicates: true });
          if (error) throw new Error(`กู้คืนห้องเรียนไม่สำเร็จ: ${error.message}`);
          restoredClassrooms = clsPayload.length;
        }
      }

      if (backupPreview.students.length > 0) {
        const stuPayload = backupPreview.students
          .filter((s) => s.id && s.first_name)
          .map((s) => ({
            id: String(s.id),
            workspace_id: workspaceId,
            classroom_id: (s.classroom_id as string | null) || primaryClassroomId || null,
            student_code: (s.student_code as string | null) || null,
            first_name: String(s.first_name),
            last_name: String(s.last_name || ''),
            nickname: (s.nickname as string | null) || null,
            gender: (s.gender as string | null) || 'other',
            status: 'active',
          }));
        if (stuPayload.length > 0) {
          const { error } = await supabase.from('students').upsert(stuPayload, { onConflict: 'id', ignoreDuplicates: true });
          if (error) throw new Error(`กู้คืนรายชื่อนักเรียนไม่สำเร็จ: ${error.message}`);
          restoredStudents = stuPayload.length;
        }
      }

      if (backupPreview.templates.length > 0) {
        const tplPayload = backupPreview.templates
          .filter((t) => t.id && t.title && t.body)
          .map((t) => ({
            id: String(t.id),
            workspace_id: workspaceId,
            template_type: String(t.template_type || 'general'),
            title: String(t.title),
            body: String(t.body),
            channel: String(t.channel || 'line'),
            is_active: true,
            created_by: session.profile.id,
          }));
        if (tplPayload.length > 0) {
          const { error } = await supabase.from('message_templates').upsert(tplPayload, { onConflict: 'id', ignoreDuplicates: true });
          if (error) throw new Error(`กู้คืนแม่แบบข้อความไม่สำเร็จ: ${error.message}`);
          restoredTemplates = tplPayload.length;
        }
      }

      const raw = backupPreview.raw;
      await restoreMissingTableRows('student_guardians', raw.student_guardians, 'id');
      await restoreMissingTableRows('school_calendar_days', raw.school_calendar_days, 'id');
      await restoreMissingTableRows('workspace_schedule_settings', raw.workspace_schedule_settings, 'workspace_id');
      await restoreMissingTableRows('attendance_sessions', raw.attendance_sessions, 'id');
      const restoredAttendance = await restoreMissingTableRows('attendance_records', raw.attendance_records, 'id');
      await restoreMissingTableRows('score_assessments', raw.score_assessments, 'id');
      const restoredScores = await restoreMissingTableRows('score_entries', raw.score_entries, 'id');
      const restoredBehavior = await restoreMissingTableRows('behavior_records', raw.behavior_records, 'id');
      await restoreMissingTableRows('student_health_records', raw.student_health_records, 'id');
      await restoreMissingTableRows('student_desirable_records', raw.student_desirable_records, 'id');
      await restoreMissingTableRows('savings_accounts', raw.savings_accounts, 'id');
      await restoreMissingTableRows('savings_transactions', raw.savings_transactions, 'id');

      setNotice({
        tone: 'success',
        text: `✓ กู้คืนข้อมูลจากไฟล์สำรองเสร็จสิ้น (${restoredClassrooms} ห้อง, ${restoredStudents} นักเรียน, ${restoredAttendance} เช็กชื่อ, ${restoredScores} คะแนน, ${restoredBehavior} พฤติกรรม, ${restoredTemplates} แม่แบบ)`,
      });
      setBackupPreview(null);
      await loadLiveSafetyData();
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof Error ? err.message : 'กู้คืนข้อมูลไม่สำเร็จ' });
    } finally {
      setIsRestoringFile(false);
    }
  }

  // --- Action 3: Auto-Fix Live Health Issues ---
  async function handleFixHealthIssue(issue: LiveHealthIssue) {
    if (!supabase || !workspaceId || !canManageSafety) return;
    setFixingIssueId(issue.id);
    setNotice(null);
    try {
      if (issue.fixType === 'assign_classroom' && primaryClassroomId && Array.isArray(issue.payload)) {
        const ids = issue.payload as string[];
        const { error } = await supabase
          .from('students')
          .update({ classroom_id: primaryClassroomId })
          .eq('workspace_id', workspaceId)
          .in('id', ids);
        if (error) throw new Error(error.message);
        setNotice({ tone: 'success', text: `✓ ผูกนักเรียน ${ids.length} คนเข้าห้องเรียนหลักเรียบร้อยแล้ว` });
        await loadLiveSafetyData();
      } else if (issue.fixType === 'repair_savings' && Array.isArray(issue.payload)) {
        const list = issue.payload as Array<{ accountId: string; expectedBalance: number }>;
        for (const item of list) {
          const { error } = await supabase
            .from('savings_accounts')
            .update({ balance: item.expectedBalance, updated_at: new Date().toISOString() })
            .eq('id', item.accountId)
            .eq('workspace_id', workspaceId);
          if (error) throw new Error(error.message);
        }
        setNotice({ tone: 'success', text: `✓ ซ่อมแซมยอดบัญชีเงินออม ${list.length} บัญชีให้ตรงกับรายการฝาก-ถอนเรียบร้อยแล้ว` });
        await loadLiveSafetyData();
      }
    } catch (err) {
      setNotice({ tone: 'error', text: `แก้ไขอัตโนมัติไม่สำเร็จ: ${err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'}` });
    } finally {
      setFixingIssueId(null);
    }
  }

  // --- Action 4: Real Trash Restore / Purge ---
  async function handleRestoreTrash(item: TrashItem) {
    if (!supabase || !workspaceId || !canManageSafety) return;
    setBusyTrashId(item.id);
    setNotice(null);
    try {
      if (item.kind === 'student' && item.payload?.first_name) {
        const p = item.payload;
        const { error: restoreStudentErr } = await supabase.from('students').upsert({
          id: String(p.id || item.id),
          workspace_id: workspaceId,
          classroom_id: (p.classroom_id as string | null) || primaryClassroomId || null,
          student_code: (p.student_code as string | null) || null,
          first_name: String(p.first_name),
          last_name: String(p.last_name || ''),
          nickname: (p.nickname as string | null) || null,
          gender: (p.gender as string | null) || 'other',
          birth_date: (p.birth_date as string | null) || null,
          metadata: (p.metadata as Record<string, unknown> | undefined) || undefined,
          care_flags: (p.care_flags as Record<string, unknown> | undefined) || undefined,
          health_flags: (p.health_flags as Record<string, unknown> | undefined) || undefined,
          status: 'active',
        });
        if (restoreStudentErr) throw new Error(restoreStudentErr.message);
      } else {
        setNotice({
          tone: 'error',
          text: `ยังไม่รองรับการกู้คืนรายการประเภท "${item.kind}" อัตโนมัติ กรุณากู้คืนผ่านไฟล์ Backup เพื่อป้องกันข้อมูลไม่ครบ`,
        });
        return;
      }
      const { error } = await supabase
        .from('trash_items')
        .update({
          restore_status: 'restored',
          restored_by: session.profile.id,
          restored_at: new Date().toISOString(),
        })
        .eq('id', item.id)
        .eq('workspace_id', workspaceId);
      if (error) throw new Error(error.message);
      setNotice({ tone: 'success', text: `✓ กู้คืน "${item.title}" กลับเข้าระบบเรียบร้อยแล้ว` });
      await loadLiveSafetyData();
    } catch (err) {
      setNotice({ tone: 'error', text: `กู้คืนไม่สำเร็จ: ${err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'}` });
    } finally {
      setBusyTrashId(null);
    }
  }

  async function handlePurgeTrash(item: TrashItem) {
    if (!supabase || !workspaceId || !canManageSafety) return;
    if (!window.confirm(`ลบ "${item.title}" ออกจากถังขยะถาวรหรือไม่? (ไม่สามารถกู้คืนได้อีก)`)) return;
    setBusyTrashId(item.id);
    setNotice(null);
    const { error } = await supabase
      .from('trash_items')
      .update({
        restore_status: 'purged',
        purged_by: session.profile.id,
        purged_at: new Date().toISOString(),
      })
      .eq('id', item.id)
      .eq('workspace_id', workspaceId);
    setBusyTrashId(null);
    if (error) {
      setNotice({ tone: 'error', text: `ลบถาวรไม่สำเร็จ: ${error.message}` });
    } else {
      setSelectedTrashIds((prev) => prev.filter((id) => id !== item.id));
      setNotice({ tone: 'success', text: `ลบ "${item.title}" ออกจากถังขยะถาวรแล้ว` });
      await loadLiveSafetyData();
    }
  }

  function toggleTrashSelection(id: string) {
    setSelectedTrashIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleBulkRestoreTrash() {
    if (!supabase || !workspaceId || !canManageSafety || selectedTrashIds.length === 0) return;
    const targets = trashItems.filter((item) => selectedTrashIds.includes(item.id) && !item.restored);
    if (targets.length === 0) {
      setNotice({ tone: 'info', text: 'รายการที่เลือกถูกกู้คืนไปแล้วทั้งหมด' });
      return;
    }
    if (!window.confirm(`ยืนยันกู้คืนรายการที่เลือก ${targets.length} รายการกลับเข้าระบบหรือไม่?`)) return;

    setIsBulkTrashBusy(true);
    setNotice(null);
    try {
      const studentPayloads = targets
        .filter((item) => item.kind === 'student' && item.payload?.first_name)
        .map((item) => {
          const p = item.payload;
          return {
            id: String(p.id || item.id),
            workspace_id: workspaceId,
            classroom_id: (p.classroom_id as string | null) || primaryClassroomId || null,
            student_code: (p.student_code as string | null) || null,
            first_name: String(p.first_name),
            last_name: String(p.last_name || ''),
            nickname: (p.nickname as string | null) || null,
            gender: (p.gender as string | null) || 'other',
            status: 'active',
          };
        });
      if (studentPayloads.length > 0) {
        const { error: stuErr } = await supabase.from('students').upsert(studentPayloads);
        if (stuErr) throw new Error(stuErr.message);
      }

      const { error } = await supabase
        .from('trash_items')
        .update({
          restore_status: 'restored',
          restored_by: session.profile.id,
          restored_at: new Date().toISOString(),
        })
        .eq('workspace_id', workspaceId)
        .in('id', targets.map((t) => t.id));
      if (error) throw new Error(error.message);

      setSelectedTrashIds([]);
      setNotice({ tone: 'success', text: `✓ กู้คืน ${targets.length} รายการกลับเข้าระบบเรียบร้อยแล้ว` });
      await loadLiveSafetyData();
    } catch (err) {
      setNotice({ tone: 'error', text: `กู้คืนแบบกลุ่มไม่สำเร็จ: ${err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'}` });
    } finally {
      setIsBulkTrashBusy(false);
    }
  }

  async function handleBulkPurgeTrash(idsToPurge: string[], label: string) {
    if (!supabase || !workspaceId || !canManageSafety || idsToPurge.length === 0) return;
    if (!window.confirm(`ยืนยัน${label} (${idsToPurge.length} รายการ) ถาวรหรือไม่? เมื่อลบแล้วไม่สามารถกู้คืนได้อีก`)) return;

    setIsBulkTrashBusy(true);
    setNotice(null);
    const { error } = await supabase
      .from('trash_items')
      .update({
        restore_status: 'purged',
        purged_by: session.profile.id,
        purged_at: new Date().toISOString(),
      })
      .eq('workspace_id', workspaceId)
      .in('id', idsToPurge);
    setIsBulkTrashBusy(false);

    if (error) {
      setNotice({ tone: 'error', text: `ล้างถังขยะไม่สำเร็จ: ${error.message}` });
    } else {
      setSelectedTrashIds([]);
      setNotice({ tone: 'success', text: `✓ ${label} (${idsToPurge.length} รายการ) เรียบร้อยแล้ว` });
      await loadLiveSafetyData();
    }
  }

  // --- Action 5: Real Message Templates CRUD ---
  async function handleAddTemplate() {
    if (!supabase || !workspaceId || !canManageSafety) return;
    if (!templateDraft.title.trim() || !templateDraft.body.trim()) {
      setNotice({ tone: 'error', text: 'กรุณากรอกชื่อแม่แบบและเนื้อหาข้อความ' });
      return;
    }
    setIsSavingTpl(true);
    setNotice(null);
    const { error } = await supabase.from('message_templates').insert({
      workspace_id: workspaceId,
      template_type: templateDraft.templateType,
      title: templateDraft.title.trim(),
      body: templateDraft.body.trim(),
      channel: 'line',
      is_active: true,
      created_by: session.profile.id,
    });
    setIsSavingTpl(false);
    if (error) {
      setNotice({ tone: 'error', text: `บันทึกข้อความสำเร็จรูปไม่สำเร็จ: ${error.message}` });
    } else {
      setTemplateDraft({ templateType: 'general', title: '', body: 'เรียนผู้ปกครองของ {{student_name}} ' });
      setNotice({ tone: 'success', text: '✓ บันทึกข้อความสำเร็จรูปลงฐานข้อมูลเรียบร้อยแล้ว' });
      await loadLiveSafetyData();
    }
  }

  async function handleSeedStarterTemplates() {
    if (!supabase || !workspaceId || !canManageSafety) return;
    setIsSavingTpl(true);
    const { error } = await supabase.from('message_templates').insert(
      DEFAULT_STARTER_TEMPLATES.map((t) => ({
        ...t,
        workspace_id: workspaceId,
        is_active: true,
        created_by: session.profile.id,
      })),
    );
    setIsSavingTpl(false);
    if (error) {
      setNotice({ tone: 'error', text: `ติดตั้งแม่แบบมาตรฐานไม่สำเร็จ: ${error.message}` });
    } else {
      setNotice({ tone: 'success', text: '✓ ติดตั้งข้อความสำเร็จรูปมาตรฐาน 3 ชุดเรียบร้อยแล้ว' });
      await loadLiveSafetyData();
    }
  }

  async function handleDeleteTemplate(tpl: MessageTemplate) {
    if (!supabase || !workspaceId || !canManageSafety) return;
    if (!window.confirm(`ลบแม่แบบ "${tpl.title}" หรือไม่?`)) return;
    const { error } = await supabase
      .from('message_templates')
      .update({ is_active: false })
      .eq('id', tpl.id)
      .eq('workspace_id', workspaceId);
    if (error) {
      setNotice({ tone: 'error', text: `ลบแม่แบบไม่สำเร็จ: ${error.message}` });
    } else {
      setTemplates((prev) => prev.filter((item) => item.id !== tpl.id));
      setNotice({ tone: 'success', text: `ลบแม่แบบ "${tpl.title}" แล้ว` });
    }
  }

  async function copyTemplateBody(tpl: MessageTemplate) {
    try {
      await navigator.clipboard.writeText(tpl.body);
      setCopiedTplId(tpl.id);
      window.setTimeout(() => setCopiedTplId((prev) => (prev === tpl.id ? null : prev)), 1800);
    } catch {
      setNotice({ tone: 'error', text: 'คัดลอกข้อความไม่สำเร็จ' });
    }
  }

  return (
    <main className="app-page">
      {/* Header */}
      <div className="app-page-header">
        <div>
          <span className="nexus-kicker">
            <DatabaseZap size={16} aria-hidden="true" />
            Data Safety & Backup Center
          </span>
          <h1 className="app-page-title">สำรองข้อมูล & ดูแลความปลอดภัยข้อมูล</h1>
          <p className="app-page-description">
            สำรองข้อมูลโรงเรียนเก็บไว้บนเครื่อง กู้คืนไฟล์สำรอง สแกนตรวจหาข้อมูลซ้ำหรือยอดเงินออมผิดปกติ และจัดการถังขยะได้จริงในจุดเดียว
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isLoading}
            onClick={() => void loadLiveSafetyData()}
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 shadow-xs hover:bg-slate-50"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} /> สแกนข้อมูลล่าสุด
          </button>
          {activeTab !== 'backup' ? (
            <button
              type="button"
              disabled={isBackingUp || !workspaceId}
              onClick={() => void handleExportBackup()}
              className="blue-action inline-flex h-11 items-center gap-2 rounded-2xl px-5 text-xs font-black shadow-sm disabled:opacity-50"
            >
              {isBackingUp ? <RefreshCw size={15} className="animate-spin" /> : <Download size={15} />}
              <span>{isBackingUp ? 'กำลังสำรอง...' : 'สำรองข้อมูลเดี๋ยวนี้ (.JSON)'}</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* Real Live KPI Strip (zero fake numbers!) */}
      <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="nexus-card p-4">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">ห้องเรียน / นักเรียน</p>
          <p className="mt-1.5 text-2xl font-black tabular-nums text-slate-950">
            {stats.students} <span className="text-xs font-bold text-slate-400">คน ({stats.classrooms} ห้อง)</span>
          </p>
        </div>
        <div className="nexus-card p-4">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">รายการเงินออม</p>
          <p className="mt-1.5 text-2xl font-black tabular-nums text-teal-700">
            {stats.savingsTransactions.toLocaleString('th-TH')} <span className="text-xs font-bold text-slate-400">รายการ</span>
          </p>
        </div>
        <div className="nexus-card p-4">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">ปัญหาข้อมูลที่พบ</p>
          <p className={`mt-1.5 text-2xl font-black tabular-nums ${healthIssues.length > 0 ? 'text-amber-600' : 'text-emerald-700'}`}>
            {healthIssues.length === 0 ? 'ปกติ (0)' : `${healthIssues.length} จุด`}
          </p>
        </div>
        <div className="nexus-card p-4">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">ในถังขยะ</p>
          <p className="mt-1.5 text-2xl font-black tabular-nums text-rose-700">{activeTrashCount}</p>
        </div>
        <div className="nexus-card col-span-2 p-4 lg:col-span-1">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">สำรองล่าสุด</p>
          <p className="mt-1.5 text-xs font-black text-slate-800">{formatThaiDateTime(stats.lastBackupAt)}</p>
        </div>
      </section>

      {/* Clean 4-Tab Bar */}
      <div className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-xs">
        {[
          { badge: null, icon: Download, id: 'backup', label: '1. สำรอง & กู้คืนไฟล์' },
          { badge: healthIssues.length > 0 ? healthIssues.length : null, icon: ShieldCheck, id: 'health', label: '2. ตรวจสุขภาพข้อมูล' },
          { badge: activeTrashCount > 0 ? activeTrashCount : null, icon: Trash2, id: 'trash', label: '3. ถังขยะและกู้คืน' },
          { badge: templates.length > 0 ? templates.length : null, icon: MessageSquareText, id: 'templates', label: '4. ข้อความสำเร็จรูป' },
        ].map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as SafetyTab)}
              className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-black transition ${
                active ? 'bg-slate-950 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
              }`}
            >
              <Icon size={15} className={active ? 'text-cyan-300' : 'text-slate-400'} />
              <span>{t.label}</span>
              {t.badge !== null ? (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                    t.id === 'health' && healthIssues.length > 0
                      ? active
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-amber-100 text-amber-800'
                      : active
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {t.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {notice ? (
        <div
          className={`mt-4 flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black ${
            notice.tone === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : notice.tone === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-cyan-200 bg-cyan-50 text-cyan-800'
          }`}
        >
          {notice.tone === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          <span>{notice.text}</span>
        </div>
      ) : null}

      {isLoading ? (
        <div className="nexus-card mt-5 p-10 text-center">
          <NexusAuroraInline label="กำลังสแกนฐานข้อมูลจริงของโรงเรียน..." />
        </div>
      ) : null}

      {/* TAB 1: REAL BACKUP & RESTORE */}
      {!isLoading && activeTab === 'backup' ? (
        <section className="mt-5 grid gap-5 lg:grid-cols-2">
          {/* Backup Card */}
          <div className="nexus-card flex flex-col justify-between p-5 sm:p-6">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-800 ring-1 ring-emerald-200">
                <Download size={13} /> สำรองข้อมูลลงเครื่อง
              </span>
              <h2 className="mt-3 text-xl font-black text-slate-950">ดาวน์โหลดไฟล์สำรองของ “{schoolName}”</h2>
              <p className="mt-1.5 text-xs font-semibold leading-6 text-slate-600">
                ดึงข้อมูลจริงทั้งหมดในพื้นที่ทำงานนี้ออกมาเป็นไฟล์ `.json` เพื่อเก็บไว้ในคอมพิวเตอร์, Flash Drive หรือ Google Drive เผื่อกรณีฉุกเฉิน
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2.5 text-xs">
                {[
                  { label: 'ห้องเรียนทั้งหมด', val: `${stats.classrooms} ห้อง` },
                  { label: 'รายชื่อนักเรียน', val: `${stats.students} คน` },
                  { label: 'บัญชีเงินออม', val: `${stats.savingsAccounts} บัญชี` },
                  { label: 'ประวัติฝาก-ถอนเงินออม', val: `${stats.savingsTransactions} รายการ` },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                    <p className="text-[11px] font-bold text-slate-500">{item.label}</p>
                    <p className="mt-0.5 text-sm font-black text-slate-900">{item.val}</p>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={isBackingUp || !workspaceId}
              onClick={() => void handleExportBackup()}
              className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50"
            >
              {isBackingUp ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
              <span>{isBackingUp ? 'กำลังรวบรวมข้อมูล...' : 'ดาวน์โหลดไฟล์สำรองข้อมูล (.JSON)'}</span>
            </button>
          </div>

          {/* Restore Card */}
          <div className="nexus-card p-5 sm:p-6">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-50 px-3 py-1 text-[11px] font-black text-cyan-800 ring-1 ring-cyan-200">
              <FileCheck2 size={13} /> ตรวจสอบ & กู้คืนจากไฟล์สำรอง
            </span>
            <h2 className="mt-3 text-xl font-black text-slate-950">กู้คืนข้อมูลที่หายไปอย่างปลอดภัย</h2>
            <p className="mt-1.5 text-xs font-semibold leading-6 text-slate-600">
              เลือกไฟล์ `.json` ที่เคยสำรองไว้ ระบบจะแสดงสรุปข้อมูลให้ตรวจสอบก่อน และกู้คืนเฉพาะข้อมูลที่หายไปโดยไม่ลบข้อมูลปัจจุบันทิ้ง
            </p>

            <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/70 p-6 text-center transition hover:border-cyan-300 hover:bg-cyan-50/40">
              <FileUp size={24} className="text-cyan-700" />
              <span className="mt-2 text-xs font-black text-slate-700">คลิกเพื่อเลือกไฟล์สำรองข้อมูล (.json)</span>
              <span className="mt-0.5 text-[11px] font-semibold text-slate-400">รองรับไฟล์จาก ClassCare 360 ทั้งแบบรายโรงเรียนและแบบทั้งระบบ</span>
              <input
                type="file"
                accept=".json,application/json"
                className="sr-only"
                onChange={(e) => void handleSelectBackupFile(e.target.files?.[0] || null)}
              />
            </label>

            {backupFileError ? (
              <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-black text-rose-700">{backupFileError}</p>
            ) : null}

            {backupPreview ? (
              <div className="mt-4 space-y-3 rounded-2xl border border-cyan-200 bg-cyan-50/60 p-4 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-black text-cyan-950">พบไฟล์สำรอง: {backupPreview.schoolName}</p>
                  <span className="text-[11px] font-bold text-cyan-700">{formatThaiDateTime(backupPreview.exportedAt)}</span>
                </div>
                <p className="font-semibold text-slate-700">
                  ห้องเรียน: <strong>{backupPreview.classrooms.length}</strong> · นักเรียน: <strong>{backupPreview.students.length}</strong> · เช็กชื่อ:{' '}
                  <strong>{backupPreview.attendanceCount}</strong> · คะแนน: <strong>{backupPreview.scoresCount}</strong> · พฤติกรรม:{' '}
                  <strong>{backupPreview.behaviorCount}</strong> · สุขภาพ: <strong>{backupPreview.healthCount}</strong> · คุณลักษณะ:{' '}
                  <strong>{backupPreview.desirableCount}</strong> · เงินออม: <strong>{backupPreview.savingsTxCount}</strong> · แม่แบบ:{' '}
                  <strong>{backupPreview.templates.length}</strong>
                </p>
                <button
                  type="button"
                  disabled={isRestoringFile || !canManageSafety}
                  onClick={() => void handleSafeRestoreFromBackup()}
                  className="blue-action inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl px-4 text-xs font-black disabled:opacity-50"
                >
                  {isRestoringFile ? <RefreshCw size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                  <span>{isRestoringFile ? 'กำลังกู้คืนข้อมูล...' : 'ยืนยันกู้คืนข้อมูลที่หายไปจากไฟล์นี้'}</span>
                </button>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* TAB 2: LIVE DATA HEALTH SCANNER */}
      {!isLoading && activeTab === 'health' ? (
        <section className="nexus-card mt-5 p-5 sm:p-6">
          <div>
            <h2 className="text-xl font-black text-slate-950">ผลสแกนสุขภาพข้อมูลจริงของ “{schoolName}”</h2>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">
              ตรวจสอบจริงจากตารางนักเรียน ห้องเรียน บัญชีเงินออม และตั้งค่ารายงาน (ไม่มีข้อมูลจำลอง)
            </p>
          </div>

          {healthIssues.length === 0 ? (
            <div className="mt-5 flex flex-col items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50/70 p-8 text-center">
              <CheckCircle2 size={36} className="text-emerald-600" />
              <p className="mt-3 text-base font-black text-emerald-950">ข้อมูลห้องเรียนสมบูรณ์ 100%</p>
              <p className="mt-1 text-xs font-semibold text-emerald-800">
                ไม่พบนักเรียนซ้ำซ้อน ไม่พบนักเรียนหลุดห้อง และยอดบัญชีเงินออมตรงกับรายการฝาก-ถอนทุกบัญชี
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {healthIssues.map((issue) => (
                <div
                  key={issue.id}
                  className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
                    issue.severity === 'danger'
                      ? 'border-rose-200 bg-rose-50/80 text-rose-900'
                      : issue.severity === 'warning'
                        ? 'border-amber-200 bg-amber-50/80 text-amber-950'
                        : 'border-cyan-200 bg-cyan-50/70 text-cyan-950'
                  }`}
                >
                  <div className="min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider opacity-75">
                      {issue.severity === 'danger' ? 'ควรแก้ไขทันที' : issue.severity === 'warning' ? 'ข้อควรตรวจสอบ' : 'คำแนะนำ'}
                    </span>
                    <h3 className="mt-0.5 text-base font-black">{issue.title}</h3>
                    <p className="mt-1 text-xs font-semibold leading-5 opacity-90">{issue.detail}</p>
                  </div>
                  <div className="shrink-0">
                    {issue.fixType === 'assign_classroom' || issue.fixType === 'repair_savings' ? (
                      <button
                        type="button"
                        disabled={fixingIssueId === issue.id || !canManageSafety}
                        onClick={() => void handleFixHealthIssue(issue)}
                        className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-slate-950 px-4 text-xs font-black text-white shadow-xs hover:bg-slate-800 disabled:opacity-50"
                      >
                        <Wrench size={14} /> {fixingIssueId === issue.id ? 'กำลังซ่อม...' : issue.linkLabel}
                      </button>
                    ) : issue.linkTo ? (
                      <Link
                        to={issue.linkTo}
                        className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-white px-4 text-xs font-black text-slate-800 shadow-xs ring-1 ring-black/10 hover:bg-slate-50"
                      >
                        {issue.linkLabel || 'เปิดตรวจสอบ'} <ArrowRight size={14} />
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {/* TAB 3: REAL TRASH & RESTORE */}
      {!isLoading && activeTab === 'trash' ? (
        <section className="nexus-card mt-5 p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-950">ถังขยะและกู้คืนข้อมูล ({trashItems.length} รายการ)</h2>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">
                รายการที่ถูกลบจากระบบจะเก็บไว้ที่นี่เพื่อให้ครูกู้คืนได้ทันทีหากลบผิด หรือกดลบถาวรเพื่อล้างพื้นที่
              </p>
            </div>
            {trashItems.length > 0 && canManageSafety ? (
              <button
                type="button"
                disabled={isBulkTrashBusy}
                onClick={() => void handleBulkPurgeTrash(trashItems.map((i) => i.id), 'ล้างถังขยะทั้งหมด')}
                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 text-xs font-black text-rose-700 hover:bg-rose-100 disabled:opacity-40"
              >
                <Trash2 size={14} /> ล้างถังขยะทั้งหมด ({trashItems.length})
              </button>
            ) : null}
          </div>

          {trashItems.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-8 text-center">
              <Trash2 size={28} className="mx-auto text-slate-300" />
              <p className="mt-2 text-sm font-black text-slate-600">ถังขยะว่างเปล่า</p>
              <p className="mt-1 text-xs font-semibold text-slate-400">ยังไม่มีรายการนักเรียน ห้องเรียน หรือชุดคะแนนที่ถูกลบในพื้นที่ทำงานนี้</p>
            </div>
          ) : (
            <>
              {/* Search & Kind Filter Toolbar */}
              <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { id: 'all' as const, label: 'ทั้งหมด', count: trashKindCounts.all },
                    { id: 'student' as const, label: 'นักเรียน', count: trashKindCounts.student },
                    { id: 'classroom' as const, label: 'ห้องเรียน', count: trashKindCounts.classroom },
                    { id: 'other' as const, label: 'อื่น ๆ', count: trashKindCounts.other },
                  ].map((pill) => {
                    const active = trashKindFilter === pill.id;
                    return (
                      <button
                        key={pill.id}
                        type="button"
                        onClick={() => setTrashKindFilter(pill.id)}
                        className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-black transition ${
                          active
                            ? 'bg-slate-950 text-white shadow-xs'
                            : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span>{pill.label}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                          {pill.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <label className="relative block w-full lg:w-72">
                  <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={trashSearch}
                    onChange={(e) => setTrashSearch(e.target.value)}
                    placeholder="ค้นหาชื่อรายการในถังขยะ..."
                    className="nexus-field h-9 w-full pl-9 pr-3 text-xs font-bold"
                  />
                </label>
              </div>

              {/* Bulk Selection Bar */}
              {canManageSafety && filteredTrashItems.length > 0 ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-xs">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="inline-flex cursor-pointer items-center gap-2 font-black text-slate-700">
                      <input
                        type="checkbox"
                        checked={
                          paginatedTrashItems.length > 0 &&
                          paginatedTrashItems.every((i) => selectedTrashIds.includes(i.id))
                        }
                        onChange={() => {
                          const allOnPageSelected =
                            paginatedTrashItems.length > 0 &&
                            paginatedTrashItems.every((i) => selectedTrashIds.includes(i.id));
                          if (allOnPageSelected) {
                            const pageIds = new Set(paginatedTrashItems.map((i) => i.id));
                            setSelectedTrashIds((prev) => prev.filter((id) => !pageIds.has(id)));
                          } else {
                            setSelectedTrashIds((prev) =>
                              Array.from(new Set([...prev, ...paginatedTrashItems.map((i) => i.id)])),
                            );
                          }
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-cyan-600"
                      />
                      <span>เลือกหน้านี้ ({paginatedTrashItems.length})</span>
                    </label>
                    {selectedTrashIds.length > 0 ? (
                      <>
                        <span className="rounded-full bg-cyan-100 px-2.5 py-0.5 text-[11px] font-black text-cyan-900">
                          เลือกแล้ว {selectedTrashIds.length} รายการ
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedTrashIds([])}
                          className="font-black text-slate-500 underline hover:text-slate-800"
                        >
                          ยกเลิกเลือก
                        </button>
                      </>
                    ) : null}
                  </div>
                  {selectedTrashIds.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={isBulkTrashBusy}
                        onClick={() => void handleBulkRestoreTrash()}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-[11px] font-black text-emerald-800 hover:bg-emerald-100 disabled:opacity-40"
                      >
                        <RotateCcw size={13} /> กู้คืนที่เลือก ({selectedTrashIds.length})
                      </button>
                      <button
                        type="button"
                        disabled={isBulkTrashBusy}
                        onClick={() => void handleBulkPurgeTrash(selectedTrashIds, 'ลบรายการที่เลือกออกจากถังขยะ')}
                        className="inline-flex h-8 items-center gap-1 rounded-lg bg-rose-600 px-3 text-[11px] font-black text-white hover:bg-rose-700 disabled:opacity-40"
                      >
                        <Trash2 size={13} /> ลบถาวรที่เลือก ({selectedTrashIds.length})
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {paginatedTrashItems.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center text-xs font-bold text-slate-500">
                  ไม่พบรายการในถังขยะที่ตรงกับคำค้นหา “{trashSearch}”
                </div>
              ) : (
                <div className="mt-3 space-y-2.5">
                  {paginatedTrashItems.map((item) => {
                    const isChecked = selectedTrashIds.includes(item.id);
                    return (
                      <div
                        key={item.id}
                        className={`flex flex-col gap-3 rounded-2xl border p-3.5 sm:flex-row sm:items-center sm:justify-between ${
                          item.restored
                            ? 'border-emerald-200 bg-emerald-50/70'
                            : isChecked
                              ? 'border-cyan-300 bg-cyan-50/50'
                              : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {canManageSafety ? (
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleTrashSelection(item.id)}
                              className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-cyan-600"
                            />
                          ) : null}
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-cyan-700">
                              {trashKindLabels[item.kind]} {item.restored ? '· กู้คืนแล้ว' : ''}
                            </span>
                            <h3 className="mt-0.5 text-sm font-black text-slate-950">{item.title}</h3>
                            {item.detail ? <p className="mt-0.5 text-xs font-semibold text-slate-500">{item.detail}</p> : null}
                            <p className="mt-0.5 text-[11px] font-bold text-slate-400">ลบเมื่อ: {formatThaiDateTime(item.deletedAt)}</p>
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            disabled={item.restored || busyTrashId === item.id || isBulkTrashBusy || !canManageSafety}
                            onClick={() => void handleRestoreTrash(item)}
                            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-800 hover:bg-emerald-100 disabled:opacity-40"
                          >
                            <RotateCcw size={14} /> กู้คืน
                          </button>
                          <button
                            type="button"
                            disabled={busyTrashId === item.id || isBulkTrashBusy || !canManageSafety}
                            onClick={() => void handlePurgeTrash(item)}
                            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-black text-rose-700 hover:bg-rose-100 disabled:opacity-40"
                          >
                            <Trash2 size={14} /> ลบถาวร
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination Bar */}
              {filteredTrashItems.length > TRASH_PAGE_SIZE ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs font-black text-slate-600">
                  <span>
                    แสดง {(safeTrashPage - 1) * TRASH_PAGE_SIZE + 1}–{Math.min(safeTrashPage * TRASH_PAGE_SIZE, filteredTrashItems.length)} จาก {filteredTrashItems.length} รายการ (หน้า {safeTrashPage}/{trashTotalPages})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={safeTrashPage <= 1}
                      onClick={() => setTrashPage((p) => Math.max(1, p - 1))}
                      className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    >
                      ← ก่อนหน้า
                    </button>
                    <button
                      type="button"
                      disabled={safeTrashPage >= trashTotalPages}
                      onClick={() => setTrashPage((p) => Math.min(trashTotalPages, p + 1))}
                      className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    >
                      ถัดไป →
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {/* TAB 4: REAL MESSAGE TEMPLATES */}
      {!isLoading && activeTab === 'templates' ? (
        <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
          <div className="nexus-card p-5">
            <h2 className="text-lg font-black text-slate-950">สร้างข้อความสำเร็จรูปใหม่</h2>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">เก็บไว้คัดลอกส่งให้ผู้ปกครองผ่าน LINE / SMS ได้รวดเร็ว</p>
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-black text-slate-700">
                หมวดหมู่
                <select
                  value={templateDraft.templateType}
                  onChange={(e) => setTemplateDraft((prev) => ({ ...prev, templateType: e.target.value }))}
                  className="nexus-field mt-1 h-10 w-full px-3 text-xs font-bold"
                >
                  {Object.entries(templateTypeLabels).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-black text-slate-700">
                ชื่อแม่แบบ
                <input
                  type="text"
                  value={templateDraft.title}
                  onChange={(e) => setTemplateDraft((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="เช่น แจ้งนัดประชุมผู้ปกครอง"
                  className="nexus-field mt-1 h-10 w-full px-3 text-xs font-bold"
                />
              </label>
              <label className="block text-xs font-black text-slate-700">
                เนื้อหาข้อความ
                <textarea
                  rows={4}
                  value={templateDraft.body}
                  onChange={(e) => setTemplateDraft((prev) => ({ ...prev, body: e.target.value }))}
                  className="nexus-field mt-1 w-full p-3 text-xs font-bold"
                />
              </label>
              <button
                type="button"
                disabled={isSavingTpl || !canManageSafety}
                onClick={() => void handleAddTemplate()}
                className="blue-action inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-xs font-black disabled:opacity-50"
              >
                <Plus size={15} /> {isSavingTpl ? 'กำลังบันทึก...' : 'บันทึกข้อความสำเร็จรูป'}
              </button>
            </div>
          </div>

          <div className="nexus-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-black text-slate-950">คลังข้อความของโรงเรียน ({templates.length} ชุด)</h2>
                <p className="text-xs font-semibold text-slate-500">กดคัดลอกไปวางใน LINE กลุ่มผู้ปกครองได้ทันที</p>
              </div>
              {templates.length === 0 ? (
                <button
                  type="button"
                  disabled={isSavingTpl || !canManageSafety}
                  onClick={() => void handleSeedStarterTemplates()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-amber-100 px-3 text-xs font-black text-amber-900 hover:bg-amber-200"
                >
                  <Sparkles size={14} /> ติดตั้งแม่แบบมาตรฐาน 3 ชุด
                </button>
              ) : null}
            </div>

            {templates.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-8 text-center text-xs font-bold text-slate-400">
                ยังไม่มีข้อความสำเร็จรูป — กด “ติดตั้งแม่แบบมาตรฐาน 3 ชุด” หรือสร้างใหม่ทางด้านซ้าย
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {templates.map((tpl) => (
                  <article key={tpl.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-black text-cyan-700 ring-1 ring-slate-200">
                          {templateTypeLabels[tpl.templateType] || tpl.templateType}
                        </span>
                        <h3 className="mt-1.5 text-sm font-black text-slate-950">{tpl.title}</h3>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          type="button"
                          onClick={() => void copyTemplateBody(tpl)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-black text-slate-700 hover:bg-slate-50"
                        >
                          {copiedTplId === tpl.id ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                          {copiedTplId === tpl.id ? 'คัดลอกแล้ว' : 'คัดลอก'}
                        </button>
                        {canManageSafety ? (
                          <button
                            type="button"
                            onClick={() => void handleDeleteTemplate(tpl)}
                            className="grid h-8 w-8 place-items-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                            title="ลบแม่แบบ"
                          >
                            <Trash2 size={13} />
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-xs font-semibold leading-5 text-slate-600">{tpl.body}</p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : null}
    </main>
  );
}
