import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  FileJson,
  FileSpreadsheet,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

export interface AuditLogRow {
  id: string;
  workspace_id: string | null;
  workspace_name: string;
  actor_profile_id: string | null;
  actor_email: string;
  actor_name: string;
  action: string;
  entity_table: string;
  entity_id: string | null;
  risk_level: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface SuperadminAuditCenterProps {
  isDevelopmentDemo: boolean;
}

const ACTION_LABELS: Record<string, string> = {
  superadmin_user_deleted: 'ลบผู้ใช้ถาวร',
  superadmin_user_suspended: 'ระงับบัญชีผู้ใช้',
  superadmin_user_restored: 'คืนสถานะผู้ใช้',
  superadmin_password_reset_direct: 'รีเซ็ตรหัสผ่านโดยแอดมิน',
  superadmin_user_email_updated: 'แก้ไขอีเมลผู้ใช้',
  superadmin_user_profile_updated: 'แก้ไขข้อมูลผู้ใช้',
  superadmin_email_confirmed: 'ยืนยันอีเมลแทนผู้ใช้',
  superadmin_workspace_member_added: 'เพิ่มสมาชิกเข้าโรงเรียน',
  superadmin_workspace_member_removed: 'นำสมาชิกออกจากโรงเรียน',
  superadmin_workspace_owner_transferred: 'โอนสิทธิ์เจ้าของโรงเรียน',
  superadmin_workspace_updated: 'แก้ไขข้อมูล/ฟีเจอร์โรงเรียน',
  superadmin_workspace_vip_revoked: 'ถอดสิทธิ์ VIP โรงเรียน',
  superadmin_workspace_snapshot_exported: 'ส่งออกสำรองข้อมูลโรงเรียน',
  superadmin_broadcast_published: 'ส่งประกาศทั่วระบบ',
  superadmin_maintenance_mode_enabled: 'เปิดโหมดปิดปรับปรุงระบบ',
  superadmin_broadcast_cleared: 'ปิดประกาศทั่วระบบ',
  admin_access_granted: 'มอบสิทธิ์ Admin/SuperAdmin',
  superadmin_access_disabled: 'ปิดสิทธิ์ผู้ดูแลระบบ',
  superadmin_access_restored: 'คืนสิทธิ์ผู้ดูแลระบบ',
  workspace_deleted: 'ลบ Workspace ถาวร',
  workspace_archived: 'เก็บถาวร Workspace',
  workspace_restored: 'กู้คืน Workspace',
  payment_approved: 'อนุมัติสลิปการชำระเงิน',
  payment_rejected: 'ปฏิเสธสลิปการชำระเงิน',
};

function formatThaiDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(date);
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function SuperadminAuditCenter({ isDevelopmentDemo }: SuperadminAuditCenterProps) {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [isLoading, setIsLoading] = useState(!isDevelopmentDemo);
  const [isExportingPack, setIsExportingPack] = useState(false);
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<'all' | 'elevated' | 'normal'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'info' | 'error' | 'success'; text: string } | null>(null);

  const loadLogs = useCallback(async () => {
    if (!supabase || isDevelopmentDemo) {
      setLogs([
        {
          id: 'demo-log-1',
          workspace_id: null,
          workspace_name: 'ระบบส่วนกลาง',
          actor_profile_id: 'demo-sa',
          actor_email: 'superadmin@classcare.local',
          actor_name: 'ClassCare Admin',
          action: 'superadmin_broadcast_published',
          entity_table: 'system_broadcasts',
          entity_id: null,
          risk_level: 'normal',
          metadata: { title: 'แจ้งอัปเดตระบบรายงานเงินออม' },
          created_at: new Date().toISOString(),
        },
      ]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setNotice(null);
    const { data, error } = await supabase.rpc('superadmin_list_audit_logs', {
      search_text: null,
      risk_filter: null,
      limit_count: 250,
    });

    if (error) {
      // Fallback to direct table select if migration 0091 is not yet live
      const fallback = await supabase
        .from('audit_logs')
        .select('id,workspace_id,actor_profile_id,action,entity_table,entity_id,risk_level,metadata,created_at')
        .order('created_at', { ascending: false })
        .limit(150);

      if (fallback.error) {
        setNotice({ tone: 'error', text: `โหลดประวัติการตรวจสอบไม่สำเร็จ: ${fallback.error.message}` });
      } else {
        setLogs(
          ((fallback.data || []) as Array<Record<string, unknown>>).map((row) => ({
            id: String(row.id),
            workspace_id: (row.workspace_id as string | null) || null,
            workspace_name: row.workspace_id ? String(row.workspace_id).slice(0, 8) : 'ระบบส่วนกลาง',
            actor_profile_id: (row.actor_profile_id as string | null) || null,
            actor_email: '',
            actor_name: row.actor_profile_id ? String(row.actor_profile_id).slice(0, 8) : 'ระบบอัตโนมัติ',
            action: String(row.action || '-'),
            entity_table: String(row.entity_table || '-'),
            entity_id: (row.entity_id as string | null) || null,
            risk_level: String(row.risk_level || 'normal'),
            metadata: (row.metadata as Record<string, unknown>) || {},
            created_at: String(row.created_at || ''),
          })),
        );
      }
      setIsLoading(false);
      return;
    }

    setLogs((data || []) as AuditLogRow[]);
    setIsLoading(false);
  }, [isDevelopmentDemo]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((log) => {
      if (riskFilter === 'elevated' && !['high', 'critical'].includes(log.risk_level)) return false;
      if (riskFilter === 'normal' && ['high', 'critical'].includes(log.risk_level)) return false;
      if (!q) return true;
      const actionLabel = ACTION_LABELS[log.action] || '';
      const haystack = [
        log.action,
        actionLabel,
        log.actor_name,
        log.actor_email,
        log.workspace_name,
        log.entity_table,
        JSON.stringify(log.metadata || {}),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [logs, riskFilter, search]);

  const highRiskCount = useMemo(
    () => logs.filter((l) => l.risk_level === 'high' || l.risk_level === 'critical').length,
    [logs],
  );

  function exportCsv() {
    const escapeCell = (val: string) => `"${val.replace(/"/g, '""')}"`;
    const headers = ['เวลา', 'ระดับความเสี่ยง', 'การกระทำ', 'รหัส Action', 'ผู้ดำเนินการ', 'อีเมล', 'โรงเรียน/Workspace', 'ตาราง', 'รายละเอียด'];
    const rows = filtered.map((l) => [
      formatThaiDateTime(l.created_at),
      l.risk_level,
      ACTION_LABELS[l.action] || l.action,
      l.action,
      l.actor_name,
      l.actor_email,
      l.workspace_name,
      l.entity_table,
      JSON.stringify(l.metadata || {}),
    ]);
    const csv = '\uFEFF' + [headers, ...rows].map((r) => r.map((c) => escapeCell(String(c))).join(',')).join('\n');
    const stamp = new Date().toISOString().slice(0, 10);
    downloadFile(csv, `classcare-audit-logs-${stamp}.csv`, 'text/csv;charset=utf-8;');
    setNotice({ tone: 'success', text: `ส่งออก Audit Log จำนวน ${filtered.length} รายการเป็นไฟล์ CSV แล้ว` });
  }

  async function exportDebugPack() {
    setIsExportingPack(true);
    setNotice(null);
    try {
      let diagnostics: unknown = null;
      if (supabase && !isDevelopmentDemo) {
        const { data } = await supabase.rpc('superadmin_get_system_diagnostics');
        diagnostics = data || null;
      }

      const pack = {
        exported_at: new Date().toISOString(),
        app: 'ClassCare 360 Superadmin Debug Pack',
        url: window.location.origin,
        diagnostics,
        audit_summary: {
          total_loaded: logs.length,
          filtered_count: filtered.length,
          elevated_risk_count: highRiskCount,
        },
        audit_logs: filtered,
      };
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      downloadFile(JSON.stringify(pack, null, 2), `classcare-debug-pack-${stamp}.json`, 'application/json;charset=utf-8;');
      setNotice({ tone: 'success', text: 'ดาวน์โหลด Debug Pack (Diagnostics + Audit Logs) สำเร็จแล้ว' });
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof Error ? err.message : 'ส่งออก Debug Pack ไม่สำเร็จ' });
    } finally {
      setIsExportingPack(false);
    }
  }

  return (
    <section className="mt-5 space-y-4">
      <div className="nexus-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="nexus-kicker">
              <ShieldCheck size={17} aria-hidden="true" />
              Global Audit Trail & Debug Pack
            </div>
            <h2 className="mt-2 text-2xl font-black text-slate-950">ประวัติการตรวจสอบทั้งระบบ</h2>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              บันทึกจริงทุกการแก้ไขสิทธิ์ รีเซ็ตรหัส ลบผู้ใช้ โอนโรงเรียน อนุมัติสลิป และส่งประกาศ ข้ามทุก Workspace
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadLogs()}
              disabled={isLoading}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> รีเฟรช
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={filtered.length === 0}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 text-xs font-black text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
            >
              <FileSpreadsheet size={14} /> ส่งออก CSV
            </button>
            <button
              type="button"
              onClick={() => void exportDebugPack()}
              disabled={isExportingPack}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-black text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
            >
              {isExportingPack ? <RefreshCw size={14} className="animate-spin" /> : <FileJson size={14} />}
              <span>ดาวน์โหลด Debug Pack (JSON)</span>
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <label className="relative block flex-1 max-w-md">
            <Search size={15} className="absolute left-3.5 top-3 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อผู้ทำ, อีเมล, โรงเรียน, การกระทำ..."
              className="nexus-field h-10 w-full pl-9 pr-3 text-sm font-semibold"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: 'all', label: `ทั้งหมด (${logs.length})` },
              { key: 'elevated', label: `ความเสี่ยงสูง (${highRiskCount})` },
              { key: 'normal', label: 'ทั่วไป' },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setRiskFilter(item.key as 'all' | 'elevated' | 'normal')}
                className={`h-9 rounded-xl px-3 text-xs font-black transition ${
                  riskFilter === item.key
                    ? 'bg-slate-950 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {notice ? (
          <div
            className={`mt-4 flex items-center gap-2 rounded-2xl border p-3 text-xs font-black ${
              notice.tone === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-800'
                : notice.tone === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-sky-200 bg-sky-50 text-sky-800'
            }`}
          >
            {notice.tone === 'error' ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
            <span>{notice.text}</span>
          </div>
        ) : null}

        {/* Table */}
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full min-w-[780px] border-collapse text-left text-xs">
            <thead className="bg-slate-50 text-[11px] font-black text-slate-500">
              <tr>
                <th className="px-4 py-3">เวลา</th>
                <th className="px-4 py-3">การกระทำ</th>
                <th className="px-4 py-3">ผู้ดำเนินการ</th>
                <th className="px-4 py-3">โรงเรียน / ขอบเขต</th>
                <th className="px-4 py-3">ระดับ</th>
                <th className="px-4 py-3 text-right">รายละเอียด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center font-bold text-slate-400">
                    กำลังโหลดประวัติการตรวจสอบ...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center font-bold text-slate-400">
                    ไม่พบประวัติการตรวจสอบตามเงื่อนไขที่ค้นหา
                  </td>
                </tr>
              ) : (
                filtered.map((log) => {
                  const isExpanded = expandedId === log.id;
                  const isElevated = log.risk_level === 'high' || log.risk_level === 'critical';
                  return (
                    <Fragment key={log.id}>
                      <tr className="hover:bg-slate-50/70">
                        <td className="whitespace-nowrap px-4 py-3 font-bold text-slate-500">
                          {formatThaiDateTime(log.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-black text-slate-900">{ACTION_LABELS[log.action] || log.action}</p>
                          <p className="mt-0.5 font-mono text-[10px] text-slate-400">
                            {log.action} · {log.entity_table}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-800">{log.actor_name}</p>
                          {log.actor_email ? <p className="text-[11px] text-slate-400">{log.actor_email}</p> : null}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-700">{log.workspace_name}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                              isElevated
                                ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {isElevated ? <ShieldAlert size={11} /> : null}
                            {log.risk_level === 'critical' ? 'วิกฤต' : log.risk_level === 'high' ? 'ความเสี่ยงสูง' : 'ปกติ'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : log.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-black text-slate-600 hover:bg-slate-50"
                          >
                            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            <span>{isExpanded ? 'ซ่อน' : 'ดูข้อมูล'}</span>
                          </button>
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr className="bg-slate-50/80">
                          <td colSpan={6} className="px-4 py-3">
                            <pre className="max-h-56 overflow-auto rounded-xl bg-slate-900 p-3 font-mono text-[11px] leading-5 text-emerald-300">
                              {JSON.stringify(
                                {
                                  id: log.id,
                                  entity_table: log.entity_table,
                                  entity_id: log.entity_id,
                                  workspace_id: log.workspace_id,
                                  actor_profile_id: log.actor_profile_id,
                                  metadata: log.metadata,
                                },
                                null,
                                2,
                              )}
                            </pre>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
          <Download size={13} /> แสดงสูงสุด 250 รายการล่าสุด — กด “ดาวน์โหลด Debug Pack (JSON)” เพื่อเก็บหลักฐานพร้อมผลตรวจสุขภาพระบบ
        </p>
      </div>
    </section>
  );
}
