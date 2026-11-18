import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Banknote,
  Building2,
  CheckCircle2,
  Database,
  HardDrive,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { isSupabaseReady, supabase } from '../../lib/supabaseClient';

export interface SystemDiagnosticsData {
  checked_at: string;
  db_size_bytes: number;
  counts: {
    users: number;
    orphan_users: number;
    unconfirmed_users: number;
    active_users_7d: number;
    active_users_30d: number;
    new_users_30d: number;
    workspaces_total: number;
    workspaces_active: number;
    classrooms: number;
    students: number;
    attendance_records: number;
    savings_transactions: number;
    audit_logs: number;
    open_support_tickets: number;
    urgent_support_tickets: number;
    pending_payments: number;
    approved_payments: number;
    approved_revenue_thb: number;
  };
  buckets: Array<{ id: string; name: string; public: boolean }>;
  rpcs: Array<{ name: string; ok: boolean }>;
}

interface SuperadminHealthCenterProps {
  dbPingMs: number | null;
  isDevelopmentDemo: boolean;
  isPinging: boolean;
  onNavigateSection: (section: 'users' | 'workspaces' | 'billing' | 'support') => void;
  onPing: () => Promise<void>;
}

function formatBytes(bytes: number) {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export function SuperadminHealthCenter({
  dbPingMs,
  isDevelopmentDemo,
  isPinging,
  onNavigateSection,
  onPing,
}: SuperadminHealthCenterProps) {
  const [diag, setDiag] = useState<SystemDiagnosticsData | null>(null);
  const [isLoading, setIsLoading] = useState(!isDevelopmentDemo);
  const [error, setError] = useState<string | null>(null);

  const runDiagnostics = useCallback(async () => {
    if (!supabase || isDevelopmentDemo) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    const [, { data, error: rpcErr }] = await Promise.all([
      onPing(),
      supabase.rpc('superadmin_get_system_diagnostics'),
    ]);
    if (rpcErr) {
      setError(`ยังโหลดผลการตรวจสุขภาพจริงไม่สำเร็จ: ${rpcErr.message}`);
    } else if (data) {
      setDiag(data as SystemDiagnosticsData);
    }
    setIsLoading(false);
  }, [isDevelopmentDemo, onPing]);

  useEffect(() => {
    void runDiagnostics();
  }, [runDiagnostics]);

  const expectedBuckets = ['payment-slips', 'home-visit-photos'];
  const bucketNames = new Set((diag?.buckets || []).map((b) => b.name));
  const rpcAllOk = diag ? diag.rpcs.every((r) => r.ok) : false;
  const failedRpcs = diag ? diag.rpcs.filter((r) => !r.ok) : [];

  return (
    <section className="mt-5 space-y-5">
      {/* Header + Action */}
      <div className="nexus-card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="nexus-kicker">
              <Activity size={17} aria-hidden="true" />
              Live System Health & Platform Analytics
            </div>
            <h2 className="mt-2 text-2xl font-black text-slate-950">ตรวจสุขภาพระบบ & สถิติการใช้งานจริง</h2>
            <p className="mt-1 text-xs font-bold text-slate-500">
              ตรวจสอบจริงจากฐานข้อมูล PostgreSQL / Storage / RPCs ทุกครั้งที่กดรีเฟรช (ไม่มีค่าสมมติ)
            </p>
          </div>
          <button
            type="button"
            onClick={() => void runDiagnostics()}
            disabled={isLoading || isPinging}
            className="blue-action inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-xs font-black shadow-sm disabled:opacity-50"
          >
            <RefreshCw size={15} className={isLoading || isPinging ? 'animate-spin' : ''} />
            <span>{isLoading || isPinging ? 'กำลังตรวจสอบจริง...' : 'ตรวจสุขภาพระบบเดี๋ยวนี้'}</span>
          </button>
        </div>

        {error ? (
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-black text-rose-800">
            <AlertTriangle size={15} /> {error}
          </div>
        ) : null}

        {/* Platform Usage & Growth KPIs */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-slate-500">Database Latency</p>
              <Activity size={16} className="text-cyan-600" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <p className="text-2xl font-black tabular-nums text-slate-950">
                {dbPingMs !== null ? `${dbPingMs} ms` : '—'}
              </p>
              {dbPingMs !== null ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                    dbPingMs < 200 ? 'bg-emerald-100 text-emerald-800' : dbPingMs < 450 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {dbPingMs < 200 ? 'เร็วดีเยี่ยม' : dbPingMs < 450 ? 'ปกติ' : 'ช้า'}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-[11px] font-bold text-slate-400">
              ขนาดฐานข้อมูล: {diag ? formatBytes(diag.db_size_bytes) : '—'}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-slate-500">ผู้ใช้ Active (7 / 30 วัน)</p>
              <UserCheck size={16} className="text-emerald-600" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <p className="text-2xl font-black tabular-nums text-slate-950">
                {diag ? diag.counts.active_users_7d : '—'}
              </p>
              <span className="text-xs font-bold text-slate-400">/ {diag ? diag.counts.active_users_30d : '—'} คน</span>
            </div>
            <p className="mt-1 text-[11px] font-bold text-emerald-700">
              +{diag ? diag.counts.new_users_30d : 0} สมัครใหม่ใน 30 วัน (รวม {diag ? diag.counts.users : '—'} บัญชี)
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-slate-500">รายได้อนุมัติแล้วทั้งหมด</p>
              <Banknote size={16} className="text-amber-600" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <p className="text-2xl font-black tabular-nums text-slate-950">
                {diag ? Number(diag.counts.approved_revenue_thb || 0).toLocaleString('th-TH') : '—'}
              </p>
              <span className="text-xs font-bold text-slate-500">บาท</span>
            </div>
            <p className="mt-1 text-[11px] font-bold text-slate-400">
              อนุมัติ {diag ? diag.counts.approved_payments : 0} รายการ · รอตรวจ {diag ? diag.counts.pending_payments : 0}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-slate-500">บัญชีที่ยังไม่มีโรงเรียน</p>
              <Users size={16} className="text-indigo-600" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <p className="text-2xl font-black tabular-nums text-slate-950">
                {diag ? diag.counts.orphan_users : '—'}
              </p>
              <span className="text-xs font-bold text-slate-400">บัญชี</span>
            </div>
            <button
              type="button"
              onClick={() => onNavigateSection('workspaces')}
              className="mt-1 inline-flex items-center gap-1 text-[11px] font-black text-indigo-700 hover:underline"
            >
              ไปผูกเข้าโรงเรียนในหน้า Workspace <ArrowRight size={11} />
            </button>
          </div>
        </div>

        {/* Real Table Volume Strip */}
        {diag ? (
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: 'โรงเรียน Active', val: `${diag.counts.workspaces_active}/${diag.counts.workspaces_total}`, icon: Building2 },
              { label: 'ห้องเรียน', val: diag.counts.classrooms.toLocaleString('th-TH'), icon: TrendingUp },
              { label: 'นักเรียน', val: diag.counts.students.toLocaleString('th-TH'), icon: Users },
              { label: 'บันทึกเช็คชื่อ', val: diag.counts.attendance_records.toLocaleString('th-TH'), icon: CheckCircle2 },
              { label: 'รายการเงินออม', val: diag.counts.savings_transactions.toLocaleString('th-TH'), icon: Database },
              { label: 'Audit Logs', val: diag.counts.audit_logs.toLocaleString('th-TH'), icon: ShieldCheck },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-center">
                <p className="text-[10px] font-black text-slate-500">{item.label}</p>
                <p className="mt-0.5 text-base font-black tabular-nums text-slate-900">{item.val}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Live Checks Grid: RPCs & Storage Buckets */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* RPC Health */}
        <div className="nexus-card p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database size={18} className="text-cyan-700" />
              <h3 className="text-base font-black text-slate-950">ฟังก์ชันระบบหลังบ้าน (Database RPCs)</h3>
            </div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-black ${
                diag ? (rpcAllOk ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700') : 'bg-slate-100 text-slate-500'
              }`}
            >
              {diag ? (rpcAllOk ? `พร้อมครบ ${diag.rpcs.length}/${diag.rpcs.length}` : `ขาด ${failedRpcs.length} ตัว`) : 'กำลังตรวจ'}
            </span>
          </div>
          <div className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
            {(diag?.rpcs || []).map((rpc) => (
              <div key={rpc.name} className="flex items-center justify-between px-3.5 py-2.5 text-xs">
                <span className="font-mono font-bold text-slate-700">{rpc.name}</span>
                {rpc.ok ? (
                  <span className="inline-flex items-center gap-1 font-black text-emerald-700">
                    <CheckCircle2 size={14} /> พร้อมใช้
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-black text-rose-600">
                    <XCircle size={14} /> ยังไม่พบ
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Storage & Core Infra */}
        <div className="nexus-card p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive size={18} className="text-indigo-700" />
              <h3 className="text-base font-black text-slate-950">Storage Buckets & โครงสร้างพื้นฐาน</h3>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-black text-slate-600">
              {diag ? `${diag.buckets.length} buckets` : 'กำลังตรวจ'}
            </span>
          </div>

          <div className="mt-3 space-y-2.5">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs">
              <div>
                <p className="font-black text-slate-900">Supabase Connection</p>
                <p className="text-[11px] text-slate-500">Auth + PostgREST + Realtime</p>
              </div>
              <span className={`font-black ${isSupabaseReady ? 'text-emerald-700' : 'text-amber-700'}`}>
                {isSupabaseReady ? '✓ เชื่อมต่อแล้ว' : 'โหมดสาธิต'}
              </span>
            </div>

            {expectedBuckets.map((name) => {
              const exists = bucketNames.has(name);
              return (
                <div key={name} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs">
                  <div>
                    <p className="font-mono font-black text-slate-900">{name}</p>
                    <p className="text-[11px] text-slate-500">
                      {name === 'payment-slips' ? 'เก็บไฟล์สลิปโอนเงินและ QR รับชำระ' : 'เก็บภาพถ่ายเยี่ยมบ้านและเอกสารนักเรียน'}
                    </p>
                  </div>
                  {diag ? (
                    exists ? (
                      <span className="inline-flex items-center gap-1 font-black text-emerald-700">
                        <CheckCircle2 size={14} /> พบ Bucket
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-black text-amber-700">
                        <AlertTriangle size={14} /> ยังไม่สร้าง
                      </span>
                    )
                  ) : (
                    <span className="text-slate-400">กำลังตรวจ</span>
                  )}
                </div>
              );
            })}

            {diag && diag.counts.unconfirmed_users > 0 ? (
              <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs">
                <div>
                  <p className="font-black text-amber-950">บัญชีรอยืนยันอีเมล {diag.counts.unconfirmed_users} บัญชี</p>
                  <p className="text-[11px] text-amber-800">สามารถกดยืนยันอีเมลแทนผู้ใช้ได้ในหน้า ผู้ใช้และสิทธิ์</p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateSection('users')}
                  className="rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-black text-white hover:bg-amber-700"
                >
                  ไปยืนยัน
                </button>
              </div>
            ) : null}
          </div>

          <Link
            className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-xs font-black text-slate-700 hover:bg-slate-100"
            to="/app/dashboard?view=setup"
          >
            <span>เปิดหน้า System Readiness แบบละเอียด</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}
