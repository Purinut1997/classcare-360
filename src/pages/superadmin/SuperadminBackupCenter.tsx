import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Database,
  Download,
  ExternalLink,
  FileCheck2,
  FileUp,
  HardDrive,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';

import { supabase } from '../../lib/supabaseClient';

interface R2Backup {
  key: string;
  created_at: string;
  size_bytes: number;
}

interface BackupStatus {
  backups: R2Backup[];
  retention_days: number;
}

interface QuickWorkspaceOption {
  id: string;
  name: string;
  school_name: string | null;
}

interface BackupAuditEntry {
  id: string;
  workspace_name: string;
  actor_name: string;
  created_at: string;
  metadata: Record<string, unknown>;
}

interface InspectedSnapshot {
  fileName: string;
  exportedAt: string | null;
  schemaVersion: string;
  workspaceCount: number;
  schools: Array<{
    name: string;
    classrooms: number;
    students: number;
    savingsAccounts: number;
    savingsTransactions: number;
    totalSavingsBalance: number;
  }>;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(date);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function unavailableMessage(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes('404') || normalized.includes('not found') || normalized.includes('failed to send a request')) {
    return 'ยังไม่ได้เปิดใช้งาน Edge Function r2-backup-control บน Supabase (สามารถใช้ปุ่มสำรองข้อมูลด้านบน หรือสั่งงานผ่าน GitHub Actions ได้ทันที)';
  }
  return `เชื่อมต่อระบบ R2 ไม่สำเร็จ: ${message}`;
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

export function SuperadminBackupCenter() {
  // Instant DB Snapshot state
  const [workspaces, setWorkspaces] = useState<QuickWorkspaceOption[]>([]);
  const [snapshotWsId, setSnapshotWsId] = useState('');
  const [isExportingSingle, setIsExportingSingle] = useState(false);
  const [isExportingAll, setIsExportingAll] = useState(false);
  const [snapshotNotice, setSnapshotNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  // Backup history from audit_logs
  const [backupLogs, setBackupLogs] = useState<BackupAuditEntry[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Snapshot file verifier
  const [inspected, setInspected] = useState<InspectedSnapshot | null>(null);
  const [inspectError, setInspectError] = useState<string | null>(null);

  // Optional R2 Off-site backup state (never auto-invokes on mount to avoid 404 toast!)
  const [showR2Panel, setShowR2Panel] = useState(false);
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [selectedBackup, setSelectedBackup] = useState('');
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [isLoadingR2, setIsLoadingR2] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [r2Error, setR2Error] = useState<string | null>(null);
  const [r2Notice, setR2Notice] = useState<{ message: string; workflowUrl?: string } | null>(null);

  const loadBackupLogs = useCallback(async () => {
    if (!supabase) return;
    setIsLoadingLogs(true);
    const { data, error } = await supabase.rpc('superadmin_list_audit_logs', {
      search_text: 'superadmin_workspace_snapshot_exported',
      risk_filter: null,
      limit_count: 15,
    });
    if (!error && Array.isArray(data)) {
      setBackupLogs(data as BackupAuditEntry[]);
    }
    setIsLoadingLogs(false);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    void supabase
      .from('workspaces')
      .select('id,name,school_name')
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        const list = (data || []) as QuickWorkspaceOption[];
        setWorkspaces(list);
        if (list[0]) setSnapshotWsId((prev) => prev || list[0].id);
      });
    void loadBackupLogs();
  }, [loadBackupLogs]);

  async function downloadSingleSnapshot() {
    if (!supabase || !snapshotWsId) return;
    setIsExportingSingle(true);
    setSnapshotNotice(null);
    const { data, error } = await supabase.rpc('superadmin_export_workspace_snapshot', {
      target_workspace_id: snapshotWsId,
    });
    setIsExportingSingle(false);
    if (error) {
      setSnapshotNotice({ tone: 'error', text: `ส่งออกสำรองข้อมูลไม่สำเร็จ: ${error.message}` });
      return;
    }
    const ws = workspaces.find((w) => w.id === snapshotWsId);
    const label = (ws?.school_name || ws?.name || 'workspace').replace(/[^a-zA-Z0-9ก-๙_-]+/g, '_').slice(0, 40);
    const stamp = new Date().toISOString().slice(0, 10);
    triggerJsonDownload(data, `classcare-backup-${label}-${stamp}.json`);
    setSnapshotNotice({ tone: 'success', text: `✓ สำรองข้อมูลของ "${ws?.school_name || ws?.name}" เป็นไฟล์ .JSON เรียบร้อยแล้ว` });
    await loadBackupLogs();
  }

  async function downloadAllWorkspacesSnapshot() {
    if (!supabase || workspaces.length === 0) return;
    setIsExportingAll(true);
    setSnapshotNotice(null);
    try {
      const results: unknown[] = [];
      for (const ws of workspaces) {
        const { data, error } = await supabase.rpc('superadmin_export_workspace_snapshot', {
          target_workspace_id: ws.id,
        });
        if (error) throw new Error(`${ws.school_name || ws.name}: ${error.message}`);
        results.push(data);
      }
      const stamp = new Date().toISOString().slice(0, 10);
      triggerJsonDownload(
        {
          exported_at: new Date().toISOString(),
          schema_version: 'classcare-360-full-bundle-v1',
          workspace_count: results.length,
          snapshots: results,
        },
        `classcare-all-schools-backup-${stamp}.json`,
      );
      setSnapshotNotice({ tone: 'success', text: `✓ สำรองข้อมูลครบทั้ง ${results.length} โรงเรียนรวมเป็นไฟล์เดียวเรียบร้อยแล้ว` });
      await loadBackupLogs();
    } catch (err) {
      setSnapshotNotice({ tone: 'error', text: err instanceof Error ? err.message : 'สำรองข้อมูลทั้งระบบไม่สำเร็จ' });
    } finally {
      setIsExportingAll(false);
    }
  }

  async function handleInspectFile(file: File | null) {
    setInspected(null);
    setInspectError(null);
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const snapshots = Array.isArray(parsed.snapshots)
        ? (parsed.snapshots as Array<Record<string, unknown>>)
        : parsed.workspace
          ? [parsed]
          : [];

      if (snapshots.length === 0) {
        setInspectError('ไฟล์นี้ไม่ใช่รูปแบบไฟล์สำรองข้อมูลของ ClassCare 360');
        return;
      }

      const schools = snapshots.map((snap) => {
        const ws = (snap.workspace as Record<string, unknown> | undefined) || {};
        const classrooms = Array.isArray(snap.classrooms) ? snap.classrooms.length : 0;
        const students = Array.isArray(snap.students) ? snap.students.length : 0;
        const accounts = Array.isArray(snap.savings_accounts) ? (snap.savings_accounts as Array<Record<string, unknown>>) : [];
        const txs = Array.isArray(snap.savings_transactions) ? snap.savings_transactions.length : 0;
        const totalSavingsBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance || 0), 0);
        return {
          name: String(ws.school_name || ws.name || 'ไม่ระบุชื่อโรงเรียน'),
          classrooms,
          students,
          savingsAccounts: accounts.length,
          savingsTransactions: txs,
          totalSavingsBalance,
        };
      });

      setInspected({
        fileName: file.name,
        exportedAt: (parsed.exported_at as string | null) || null,
        schemaVersion: String(parsed.schema_version || 'unknown'),
        workspaceCount: schools.length,
        schools,
      });
    } catch {
      setInspectError('อ่านไฟล์ JSON ไม่สำเร็จ กรุณาตรวจสอบว่าไฟล์ไม่เสียหาย');
    }
  }

  const loadR2Backups = useCallback(async () => {
    if (!supabase) {
      setR2Error('ยังไม่ได้เชื่อมต่อ Supabase');
      return;
    }
    setIsLoadingR2(true);
    setR2Error(null);
    setR2Notice(null);
    const { data, error: invokeError } = await supabase.functions.invoke('r2-backup-control', { body: { action: 'status' } });
    if (invokeError) {
      setR2Error(unavailableMessage(invokeError.message));
      setIsLoadingR2(false);
      return;
    }
    if (data?.error) {
      setR2Error(unavailableMessage(String(data.error)));
      setIsLoadingR2(false);
      return;
    }
    const nextStatus = data as BackupStatus;
    setStatus(nextStatus);
    setSelectedBackup((current) =>
      current && nextStatus.backups.some((backup) => backup.key === current) ? current : nextStatus.backups[0]?.key || '',
    );
    setIsLoadingR2(false);
  }, []);

  async function requestRestore() {
    if (!supabase || !selectedBackup || reason.trim().length < 10 || confirmation !== 'กู้คืนไปยังโปรเจกต์กู้คืน') return;
    const backup = status?.backups.find((item) => item.key === selectedBackup);
    if (!backup) return;
    const approved = window.confirm(
      `ส่งคำขอกู้คืน snapshot วันที่ ${formatDate(backup.created_at)} ไปยังโปรเจกต์กู้คืนแยกหรือไม่? งานนี้จะไม่เขียนทับ production`,
    );
    if (!approved) return;

    setIsRestoring(true);
    setR2Error(null);
    setR2Notice(null);
    const { data, error: invokeError } = await supabase.functions.invoke('r2-backup-control', {
      body: {
        action: 'request-restore',
        backupKey: selectedBackup,
        reason: reason.trim(),
        confirmation: 'RESTORE TO RECOVERY PROJECT',
      },
    });
    if (invokeError || data?.error) {
      setR2Error(unavailableMessage(String(data?.error || invokeError?.message || 'ส่งคำขอกู้คืนไม่สำเร็จ')));
    } else {
      setR2Notice({
        message: 'ส่งคำขอให้ GitHub Actions แล้ว เปิดรายการงานเพื่อตรวจสถานะและอนุมัติขั้นตอน recovery',
        workflowUrl: data.workflow_url,
      });
      setConfirmation('');
      setReason('');
    }
    setIsRestoring(false);
  }

  return (
    <section className="space-y-5" aria-labelledby="superadmin-backup-title">
      {/* 1. Primary Working Backup Card: Instant Direct-DB Snapshots */}
      <div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-700 text-white shadow-sm">
              <Download size={22} />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-emerald-800">Instant Database Snapshot</p>
              <h2 id="superadmin-backup-title" className="mt-0.5 text-xl font-black text-slate-950">
                สำรองข้อมูลโรงเรียนทันที (ใช้งานได้ทันที)
              </h2>
              <p className="mt-1 max-w-2xl text-xs font-semibold leading-5 text-slate-600">
                ดึงข้อมูลจริงจาก Supabase โดยตรง (โรงเรียน, สมาชิก, แพ็กเกจ, ห้องเรียน, รายชื่อนักเรียน, บัญชีและรายการเงินออมทั้งหมด) ออกมาเก็บเป็นไฟล์ .JSON ไว้บนเครื่องได้ทันที
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isExportingAll || workspaces.length === 0}
            onClick={() => void downloadAllWorkspacesSnapshot()}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-black text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
          >
            {isExportingAll ? <RefreshCw size={15} className="animate-spin" /> : <Archive size={15} />}
            <span>{isExportingAll ? 'กำลังสำรองทุกโรงเรียน...' : `สำรองครบทั้ง ${workspaces.length} โรงเรียน`}</span>
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-2.5 rounded-2xl border border-emerald-100 bg-white/90 p-3.5 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Building2 size={15} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
            <select
              value={snapshotWsId}
              onChange={(e) => setSnapshotWsId(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs font-black text-slate-800"
            >
              {workspaces.length === 0 ? <option value="">กำลังโหลดรายชื่อโรงเรียน...</option> : null}
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.school_name || ws.name} ({ws.name})
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={isExportingSingle || !snapshotWsId}
            onClick={() => void downloadSingleSnapshot()}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-xs font-black text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50"
          >
            {isExportingSingle ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
            <span>{isExportingSingle ? 'กำลังส่งออก...' : 'สำรองเฉพาะโรงเรียนนี้ (.JSON)'}</span>
          </button>
        </div>

        {snapshotNotice ? (
          <p
            className={`mt-3 rounded-2xl border p-3 text-xs font-black ${
              snapshotNotice.tone === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-800'
                : 'border-emerald-200 bg-emerald-100/70 text-emerald-900'
            }`}
          >
            {snapshotNotice.text}
          </p>
        ) : null}
      </div>

      {/* 2. Two-Column Tools: Snapshot Verifier + Backup History */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Verify Backup File */}
        <div className="nexus-card p-5">
          <div className="flex items-center gap-2">
            <FileCheck2 size={18} className="text-cyan-700" />
            <div>
              <h3 className="text-base font-black text-slate-950">ตรวจสอบความสมบูรณ์ของไฟล์สำรอง (.JSON)</h3>
              <p className="text-xs font-semibold text-slate-500">เลือกไฟล์สำรองที่เคยดาวน์โหลดไว้เพื่อเช็กจำนวนนักเรียนและยอดเงินออมก่อนใช้งาน</p>
            </div>
          </div>

          <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/70 p-5 text-center transition hover:border-cyan-300 hover:bg-cyan-50/40">
            <FileUp size={22} className="text-cyan-700" />
            <span className="mt-2 text-xs font-black text-slate-700">คลิกเพื่อเลือกไฟล์สำรองข้อมูล (.json)</span>
            <span className="mt-0.5 text-[11px] font-semibold text-slate-400">ตรวจสอบในเครื่องทันที ไม่กระทบฐานข้อมูลจริง</span>
            <input
              type="file"
              accept=".json,application/json"
              className="sr-only"
              onChange={(e) => void handleInspectFile(e.target.files?.[0] || null)}
            />
          </label>

          {inspectError ? (
            <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-black text-rose-700">{inspectError}</p>
          ) : null}

          {inspected ? (
            <div className="mt-4 space-y-2.5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-xs">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 font-black text-emerald-900">
                  <CheckCircle2 size={15} /> ไฟล์ถูกต้องพร้อมใช้งาน
                </p>
                <span className="font-mono text-[10px] font-bold text-emerald-700">{inspected.schemaVersion}</span>
              </div>
              <p className="font-semibold text-slate-600">
                ไฟล์: <span className="font-bold text-slate-900">{inspected.fileName}</span> · สำรองเมื่อ {formatDate(inspected.exportedAt)}
              </p>
              <div className="divide-y divide-emerald-100 rounded-xl border border-emerald-100 bg-white">
                {inspected.schools.map((s, i) => (
                  <div key={`${s.name}-${i}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <span className="font-black text-slate-900">{s.name}</span>
                    <span className="font-semibold text-slate-600">
                      {s.classrooms} ห้อง · {s.students} นักเรียน · เงินออมรวม{' '}
                      <strong className="text-emerald-700">{s.totalSavingsBalance.toLocaleString('th-TH')} ฿</strong> ({s.savingsTransactions} รายการ)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Backup History */}
        <div className="nexus-card p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Clock3 size={18} className="text-slate-700" />
              <div>
                <h3 className="text-base font-black text-slate-950">ประวัติการสำรองข้อมูลล่าสุด</h3>
                <p className="text-xs font-semibold text-slate-500">บันทึกอัตโนมัติทุกครั้งที่มีการส่งออกไฟล์สำรอง</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadBackupLogs()}
              disabled={isLoadingLogs}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-black text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw size={12} className={isLoadingLogs ? 'animate-spin' : ''} /> รีเฟรช
            </button>
          </div>

          <div className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
            {isLoadingLogs ? (
              <p className="p-6 text-center text-xs font-bold text-slate-400">กำลังโหลดประวัติการสำรอง...</p>
            ) : backupLogs.length === 0 ? (
              <p className="p-6 text-center text-xs font-bold text-slate-400">
                ยังไม่มีประวัติการสำรอง — ลองกดปุ่ม “สำรองข้อมูล” ด้านบนครั้งแรกได้เลย
              </p>
            ) : (
              backupLogs.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs">
                  <div className="min-w-0">
                    <p className="truncate font-black text-slate-900">{entry.workspace_name}</p>
                    <p className="text-[11px] font-semibold text-slate-500">
                      โดย {entry.actor_name}
                      {typeof entry.metadata?.student_count === 'number'
                        ? ` · ${entry.metadata.student_count} นักเรียน`
                        : ''}
                    </p>
                  </div>
                  <span className="shrink-0 font-bold text-slate-500">{formatDate(entry.created_at)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 3. Optional Collapsible Off-site R2 Backup (does NOT auto-call undeployed Edge Function!) */}
      <div className="nexus-card overflow-hidden">
        <button
          type="button"
          onClick={() => setShowR2Panel((prev) => !prev)}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-slate-50"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-100 text-sky-700">
              <Database size={18} />
            </span>
            <div>
              <h3 className="text-sm font-black text-slate-950">ระบบสำรองอัตโนมัติภายนอก (Cloudflare R2 + GitHub Actions)</h3>
              <p className="text-xs font-semibold text-slate-500">
                ตัวเลือกเสริมระดับเซิร์ฟเวอร์: สำรองฐานข้อมูลทั้งโปรเจกต์อัตโนมัติรายวันเวลา 02:17 น. (ต้องตั้งค่า R2 Secrets และ Edge Function)
              </p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600">
            {showR2Panel ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showR2Panel ? 'ซ่อน' : 'ตั้งค่า / ตรวจสอบ'}
          </span>
        </button>

        {showR2Panel ? (
          <div className="space-y-4 border-t border-slate-100 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="grid flex-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5">
                  <p className="text-[11px] font-black text-slate-500">จุดสำรองบน R2</p>
                  <p className="mt-1 text-base font-black text-slate-900">{status ? `${status.backups.length} รายการ` : 'ยังไม่ได้ตรวจ'}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5">
                  <p className="text-[11px] font-black text-slate-500">สำรองสำเร็จล่าสุด</p>
                  <p className="mt-1 text-xs font-black text-slate-900">{formatDate(status?.backups[0]?.created_at)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5">
                  <p className="text-[11px] font-black text-slate-500">ระยะเวลาเก็บ</p>
                  <p className="mt-1 text-base font-black text-slate-900">{status ? `${status.retention_days} วัน` : '30 วัน'}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-black text-white disabled:opacity-50"
                  disabled={isLoadingR2}
                  onClick={() => void loadR2Backups()}
                  type="button"
                >
                  <RefreshCw className={isLoadingR2 ? 'animate-spin' : ''} size={14} /> ตรวจสถานะ R2
                </button>
                <a
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3.5 text-xs font-black text-sky-800 hover:bg-sky-100"
                  href="https://github.com/Purinut1997/classcare-360/actions/workflows/backup-to-r2.yml"
                  rel="noreferrer"
                  target="_blank"
                >
                  เปิด GitHub Actions <ExternalLink size={13} />
                </a>
              </div>
            </div>

            {r2Error ? (
              <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-900" role="alert">
                {r2Error}
              </p>
            ) : null}
            {r2Notice ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800" role="status">
                <p>{r2Notice.message}</p>
                {r2Notice.workflowUrl ? (
                  <a className="mt-1.5 inline-flex items-center gap-1 underline" href={r2Notice.workflowUrl} rel="noreferrer" target="_blank">
                    เปิด GitHub Actions <ExternalLink size={12} />
                  </a>
                ) : null}
              </div>
            ) : null}

            {status && status.backups.length > 0 ? (
              <>
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <ul className="divide-y divide-slate-100">
                    {status.backups.map((backup) => (
                      <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs" key={backup.key}>
                        <div className="min-w-0">
                          <p className="font-black text-slate-800">{formatDate(backup.created_at)}</p>
                          <p className="mt-0.5 break-all font-mono text-[10px] text-slate-500">{backup.key}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-slate-500">{formatBytes(backup.size_bytes)}</span>
                          <button
                            className={`rounded-xl px-3 py-1.5 font-black ${selectedBackup === backup.key ? 'bg-sky-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                            onClick={() => setSelectedBackup(backup.key)}
                            type="button"
                          >
                            {selectedBackup === backup.key ? 'เลือกแล้ว' : 'เลือกกู้คืน'}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                  <p className="flex items-center gap-2 text-xs font-black text-amber-950">
                    <HardDrive size={15} /> ส่งคำขอกู้คืนไปยังโปรเจกต์แยกเพื่อตรวจสอบ (ไม่เขียนทับ Production)
                  </p>
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <label className="text-xs font-black text-slate-600">
                      เหตุผลในการกู้คืน (อย่างน้อย 10 ตัวอักษร)
                      <input
                        className="nexus-field mt-1 h-10 w-full px-3 text-xs"
                        maxLength={300}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder="เช่น ตรวจสอบข้อมูลก่อนวันที่เกิดข้อผิดพลาด"
                        value={reason}
                      />
                    </label>
                    <label className="text-xs font-black text-slate-600">
                      พิมพ์ “กู้คืนไปยังโปรเจกต์กู้คืน” เพื่อยืนยัน
                      <input
                        className="nexus-field mt-1 h-10 w-full px-3 text-xs"
                        onChange={(event) => setConfirmation(event.target.value)}
                        value={confirmation}
                      />
                    </label>
                  </div>
                  <button
                    className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-amber-700 px-4 text-xs font-black text-white hover:bg-amber-800 disabled:opacity-40"
                    disabled={isRestoring || !selectedBackup || reason.trim().length < 10 || confirmation !== 'กู้คืนไปยังโปรเจกต์กู้คืน'}
                    onClick={() => void requestRestore()}
                    type="button"
                  >
                    <RotateCcw size={14} /> {isRestoring ? 'กำลังส่งคำขอ...' : 'ส่งคำขอกู้คืน'}
                  </button>
                </div>
              </>
            ) : status ? (
              <p className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-900">
                <AlertTriangle size={15} /> ยังไม่มีไฟล์สำรองใน R2 — เปิด GitHub Actions เพื่อสั่งรันครั้งแรก
              </p>
            ) : null}

            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
              <ShieldCheck size={14} className="text-emerald-600" /> สิทธิ์สำรองและส่งคำขอกู้คืนจำกัดเฉพาะ SuperAdmin และบันทึกลง Audit Log ทุกครั้ง
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
