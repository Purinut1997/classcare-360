import { useEffect, useMemo, useState } from 'react';
import { Download, Filter, History, Search, ShieldCheck } from 'lucide-react';

import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import type { AppSessionContext } from '../../types/core';

interface AuditCenterPageProps {
  session: AppSessionContext;
}

type AuditRiskLevel = 'low' | 'normal' | 'high' | 'critical';
type AuditRiskFilter = 'all' | AuditRiskLevel;

interface AuditLogRow {
  action: string;
  actor_profile_id: string | null;
  actor_role: string | null;
  created_at: string;
  entity_id: string | null;
  entity_table: string | null;
  id: string;
  metadata: Record<string, unknown>;
  risk_level: AuditRiskLevel;
}

const demoAuditLogs: AuditLogRow[] = [
  {
    action: 'student_home_visit.saved',
    actor_profile_id: 'demo-teacher-profile',
    actor_role: 'teacher_owner',
    created_at: new Date().toISOString(),
    entity_id: 'demo-home-visit-1',
    entity_table: 'student_home_visits',
    id: 'demo-audit-1',
    metadata: {
      completion_percent: 100,
      photo_status: 'partial',
      status: 'ready',
      student_id: 'demo-student-1',
    },
    risk_level: 'normal',
  },
  {
    action: 'student_care_case.created',
    actor_profile_id: 'demo-teacher-profile',
    actor_role: 'teacher_owner',
    created_at: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
    entity_id: 'demo-care-case-1',
    entity_table: 'student_care_cases',
    id: 'demo-audit-2',
    metadata: {
      risk_level: 'urgent',
      status: 'open',
      student_id: 'demo-student-1',
    },
    risk_level: 'high',
  },
  {
    action: 'student.status_changed',
    actor_profile_id: 'demo-teacher-profile',
    actor_role: 'teacher_owner',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    entity_id: 'demo-student-1',
    entity_table: 'students',
    id: 'demo-audit-3',
    metadata: {
      from_status: 'inactive',
      to_status: 'active',
    },
    risk_level: 'low',
  },
];

const actionLabels: Record<string, string> = {
  'student.created': 'เพิ่มข้อมูลนักเรียน',
  'student.updated': 'แก้ไขข้อมูลนักเรียน',
  'student.status_changed': 'เปลี่ยนสถานะนักเรียน',
  'student_care_case.created': 'สร้างเคสดูแล',
  'student_care_case.updated': 'แก้ไขเคสดูแล',
  'student_care_case.status_changed': 'เปลี่ยนสถานะเคสดูแล',
  'student_home_visit.fallback_saved': 'บันทึกแบบเยี่ยมบ้านแบบสำรอง',
  'student_home_visit.saved': 'บันทึกแบบเยี่ยมบ้าน กสศ.01',
  'behavior_record.created': 'บันทึกพฤติกรรมนักเรียน',
  'randomizer_session.created': 'บันทึกประวัติการสุ่ม',
  'savings_transaction.created': 'บันทึกธุรกรรมเงินออม',
  'score_assessment.created': 'สร้างชุดคะแนน',
  'score_assessment.status_changed': 'เปลี่ยนสถานะชุดคะแนน',
  'score_entries.saved': 'บันทึกคะแนน',
  'import_job.guardians_imported': 'นำเข้าผู้ปกครอง',
  'import_job.students_imported': 'นำเข้านักเรียน',
  'workspace_backup.package_created': 'สร้างชุดสำรองข้อมูล',
  'classroom.created': 'เพิ่มห้องเรียน',
  'workspace_settings.updated': 'แก้ไขตั้งค่าโรงเรียน',
};

const riskLabels: Record<AuditRiskLevel, string> = {
  critical: 'สำคัญมาก',
  high: 'ต้องติดตาม',
  low: 'ทั่วไป',
  normal: 'ปกติ',
};

const riskTones: Record<AuditRiskLevel, string> = {
  critical: 'bg-rose-100 text-rose-800 ring-rose-200',
  high: 'bg-amber-100 text-amber-800 ring-amber-200',
  low: 'bg-slate-100 text-slate-600 ring-slate-200',
  normal: 'bg-cyan-50 text-cyan-700 ring-cyan-100',
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(value));
}

function getAuditSummary(log: AuditLogRow) {
  const parts = [
    typeof log.metadata.student_id === 'string' ? `student: ${log.metadata.student_id}` : null,
    typeof log.metadata.status === 'string' ? `status: ${log.metadata.status}` : null,
    typeof log.metadata.to_status === 'string' ? `to: ${log.metadata.to_status}` : null,
    typeof log.metadata.risk_level === 'string' ? `risk: ${log.metadata.risk_level}` : null,
    typeof log.metadata.completion_percent === 'number' ? `complete: ${log.metadata.completion_percent}%` : null,
    typeof log.metadata.photo_status === 'string' ? `photo: ${log.metadata.photo_status}` : null,
    typeof log.metadata.transaction_type === 'string' ? `type: ${log.metadata.transaction_type}` : null,
    typeof log.metadata.amount === 'number' ? `amount: ${log.metadata.amount}` : null,
    typeof log.metadata.subject_name === 'string' ? `subject: ${log.metadata.subject_name}` : null,
    typeof log.metadata.percent_complete === 'number' ? `scores: ${log.metadata.percent_complete}%` : null,
    typeof log.metadata.tone === 'string' ? `tone: ${log.metadata.tone}` : null,
    typeof log.metadata.mode === 'string' ? `mode: ${log.metadata.mode}` : null,
    typeof log.metadata.participant_count === 'number' ? `participants: ${log.metadata.participant_count}` : null,
    typeof log.metadata.total_rows === 'number' ? `rows: ${log.metadata.total_rows}` : null,
    typeof log.metadata.valid_rows === 'number' ? `valid: ${log.metadata.valid_rows}` : null,
    typeof log.metadata.portal_invitations === 'number' ? `invites: ${log.metadata.portal_invitations}` : null,
    typeof log.metadata.schema_version === 'string' ? `schema: ${log.metadata.schema_version}` : null,
    typeof log.metadata.academic_year === 'string' ? `year: ${log.metadata.academic_year}` : null,
    typeof log.metadata.classroom_name === 'string' ? `classroom: ${log.metadata.classroom_name}` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' | ') : log.entity_table || 'student_360';
}

function csvEscape(value: unknown) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

export function AuditCenterPage({ session }: AuditCenterPageProps) {
  const [logs, setLogs] = useState<AuditLogRow[]>(demoAuditLogs);
  const [query, setQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<AuditRiskFilter>('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(Boolean(supabase && session.workspace));
  const [notice, setNotice] = useState<string | null>(
    isSupabaseReady ? null : 'โหมดตัวอย่าง: ตั้งค่า .env.local และรัน migration audit เพื่ออ่านประวัติจาก Supabase จริง',
  );

  useEffect(() => {
    let isMounted = true;

    async function loadAuditLogs() {
      if (!supabase || !session.workspace) {
        setLogs(demoAuditLogs);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setNotice(null);

      const { data, error } = await supabase
        .from('audit_logs')
        .select('id,actor_profile_id,actor_role,action,entity_table,entity_id,risk_level,metadata,created_at')
        .eq('workspace_id', session.workspace.id)
        .order('created_at', { ascending: false })
        .limit(200);

      if (!isMounted) return;

      if (error) {
        setNotice(error.message);
        setLogs([]);
        setIsLoading(false);
        return;
      }

      setLogs((data || []) as AuditLogRow[]);
      setIsLoading(false);
    }

    void loadAuditLogs();

    return () => {
      isMounted = false;
    };
  }, [session.workspace]);

  const actionOptions = useMemo(
    () => Array.from(new Set(logs.map((log) => log.action))).sort((a, b) => a.localeCompare(b)),
    [logs],
  );

  const filteredLogs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return logs.filter((log) => {
      if (riskFilter !== 'all' && log.risk_level !== riskFilter) return false;
      if (actionFilter !== 'all' && log.action !== actionFilter) return false;
      if (!normalizedQuery) return true;

      const haystack = [
        log.action,
        actionLabels[log.action],
        log.actor_role,
        log.entity_table,
        log.entity_id,
        getAuditSummary(log),
        JSON.stringify(log.metadata),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [actionFilter, logs, query, riskFilter]);

  const summary = useMemo(
    () => ({
      critical: logs.filter((log) => log.risk_level === 'critical').length,
      high: logs.filter((log) => log.risk_level === 'high').length,
      normal: logs.filter((log) => log.risk_level === 'normal').length,
      total: logs.length,
    }),
    [logs],
  );

  function exportCsv() {
    const rows = [
      ['created_at', 'action', 'risk_level', 'actor_role', 'entity_table', 'entity_id', 'summary'],
      ...filteredLogs.map((log) => [
        log.created_at,
        actionLabels[log.action] || log.action,
        log.risk_level,
        log.actor_role || '',
        log.entity_table || '',
        log.entity_id || '',
        getAuditSummary(log),
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(csvEscape).join(',')).join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `classcare-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="app-page">
      <section className="nexus-card overflow-hidden p-0">
        <div className="bg-slate-950 p-5 text-white sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-cyan-300/15 px-3 py-1 text-xs font-black text-cyan-100 ring-1 ring-cyan-200/20">
                <History size={15} aria-hidden="true" />
                Audit Center
              </div>
              <h1 className="mt-4 text-3xl font-black sm:text-4xl">ประวัติการใช้งานระบบ</h1>
              <p className="mt-3 max-w-3xl text-sm font-bold leading-6 text-slate-300">
                ค้นหา กรอง และส่งออก audit log ของ workspace สำหรับตรวจย้อนหลังหลังแก้ข้อมูลนักเรียน เคสดูแล และแบบเยี่ยมบ้าน
              </p>
            </div>
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-black text-slate-950 transition hover:-translate-y-0.5 hover:bg-cyan-50"
              disabled={filteredLogs.length === 0}
              onClick={exportCsv}
              type="button"
            >
              Export CSV
              <Download size={17} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-4 sm:p-5">
          {[
            { label: 'ทั้งหมด', value: summary.total, tone: 'bg-slate-950 text-white ring-slate-950' },
            { label: 'ปกติ', value: summary.normal, tone: riskTones.normal },
            { label: 'ต้องติดตาม', value: summary.high, tone: riskTones.high },
            { label: 'สำคัญมาก', value: summary.critical, tone: riskTones.critical },
          ].map((item) => (
            <div className={`rounded-3xl p-4 ring-1 ${item.tone}`} key={item.label}>
              <p className="text-xs font-black uppercase tracking-[0.16em] opacity-70">{item.label}</p>
              <p className="mt-2 text-3xl font-black">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="nexus-card mt-5 p-4 sm:p-5">
        <div className="grid gap-3 2xl:grid-cols-[minmax(0,1fr)_220px_180px]">
          <label className="grid gap-2 text-sm font-black text-slate-700">
            ค้นหา
            <span className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
              <input
                className="nexus-field h-11 w-full pl-10 pr-3"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="action, table, id, metadata"
                value={query}
              />
            </span>
          </label>
          <label className="grid gap-2 text-sm font-black text-slate-700">
            Action
            <select
              className="nexus-field h-11 px-3"
              onChange={(event) => setActionFilter(event.target.value)}
              value={actionFilter}
            >
              <option value="all">ทั้งหมด</option>
              {actionOptions.map((action) => (
                <option key={action} value={action}>
                  {actionLabels[action] || action}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-black text-slate-700">
            Risk
            <select
              className="nexus-field h-11 px-3"
              onChange={(event) => setRiskFilter(event.target.value as AuditRiskFilter)}
              value={riskFilter}
            >
              <option value="all">ทั้งหมด</option>
              <option value="low">ทั่วไป</option>
              <option value="normal">ปกติ</option>
              <option value="high">ต้องติดตาม</option>
              <option value="critical">สำคัญมาก</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-black text-sky-700 ring-1 ring-sky-100">
            <Filter size={14} aria-hidden="true" />
            แสดง {filteredLogs.length} จาก {logs.length} รายการ
          </div>
          {notice ? (
            <div className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-800 ring-1 ring-amber-100">
              {notice}
            </div>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3">
          {isLoading ? (
            <div className="rounded-3xl bg-slate-50 p-5 text-sm font-bold text-slate-500 ring-1 ring-slate-100">
              กำลังโหลด audit log...
            </div>
          ) : filteredLogs.length > 0 ? (
            filteredLogs.map((log) => (
              <article className="rounded-3xl bg-white/85 p-4 ring-1 ring-slate-100" key={log.id}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${riskTones[log.risk_level]}`}>
                        {riskLabels[log.risk_level]}
                      </span>
                      <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-black text-sky-700 ring-1 ring-sky-100">
                        {log.entity_table || 'system'}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-200">
                        {log.actor_role || '-'}
                      </span>
                    </div>
                    <h2 className="mt-3 text-lg font-black text-slate-950">
                      {actionLabels[log.action] || log.action}
                    </h2>
                    <p className="mt-2 text-sm font-bold leading-6 text-slate-500">{getAuditSummary(log)}</p>
                  </div>
                  <div className="text-left lg:text-right">
                    <p className="text-sm font-black text-slate-950">{formatDateTime(log.created_at)}</p>
                    <p className="mt-1 text-xs font-bold text-slate-400">
                      {log.entity_id ? log.entity_id.slice(0, 12) : '-'}
                    </p>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-3xl bg-slate-50 p-5 text-sm font-bold text-slate-500 ring-1 ring-slate-100">
              ไม่พบ audit log ตามเงื่อนไขที่เลือก
            </div>
          )}
        </div>
      </section>

      <section className="mt-5 rounded-3xl bg-slate-950 p-5 text-white shadow-[0_24px_70px_rgba(2,6,23,0.18)]">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-1 text-cyan-200" size={22} aria-hidden="true" />
          <div>
            <h2 className="text-lg font-black">Audit privacy guard</h2>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-300">
              Audit log เก็บ metadata แบบย่อสำหรับตรวจร่องรอยเท่านั้น ข้อมูลละเอียดของแบบเยี่ยมบ้านและเคสดูแลยังอยู่ในตารางต้นทางภายใต้ RLS ของ workspace
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
