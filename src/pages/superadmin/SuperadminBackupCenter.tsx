import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Database, ExternalLink, HardDrive, RefreshCw, RotateCcw, ShieldCheck } from 'lucide-react';

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

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(date);
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
    return 'ระบบสำรองภายนอกยังไม่พร้อมใช้งาน: deploy Edge Function r2-backup-control และตั้งค่า R2/GitHub secrets ใน Supabase ก่อน';
  }
  return `เชื่อมต่อระบบสำรองไม่สำเร็จ: ${message}`;
}

export function SuperadminBackupCenter() {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [selectedBackup, setSelectedBackup] = useState('');
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ message: string; workflowUrl?: string } | null>(null);

  const loadBackups = useCallback(async () => {
    if (!supabase) {
      setError('ยังไม่ได้เชื่อมต่อ Supabase');
      return;
    }
    setIsLoading(true);
    setError(null);
    setNotice(null);
    const { data, error: invokeError } = await supabase.functions.invoke('r2-backup-control', { body: { action: 'status' } });
    if (invokeError) {
      setError(unavailableMessage(invokeError.message));
      setIsLoading(false);
      return;
    }
    if (data?.error) {
      setError(unavailableMessage(String(data.error)));
      setIsLoading(false);
      return;
    }
    const nextStatus = data as BackupStatus;
    setStatus(nextStatus);
    setSelectedBackup((current) => current && nextStatus.backups.some((backup) => backup.key === current) ? current : nextStatus.backups[0]?.key || '');
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadBackups();
  }, [loadBackups]);

  async function requestRestore() {
    if (!supabase || !selectedBackup || reason.trim().length < 10 || confirmation !== 'กู้คืนไปยังโปรเจกต์กู้คืน') return;
    const backup = status?.backups.find((item) => item.key === selectedBackup);
    if (!backup) return;
    const approved = window.confirm(`ส่งคำขอกู้คืน snapshot วันที่ ${formatDate(backup.created_at)} ไปยังโปรเจกต์กู้คืนแยกหรือไม่? งานนี้จะไม่เขียนทับ production และต้องตรวจข้อมูลก่อนสลับระบบ`);
    if (!approved) return;

    setIsRestoring(true);
    setError(null);
    setNotice(null);
    const { data, error: invokeError } = await supabase.functions.invoke('r2-backup-control', {
      body: {
        action: 'request-restore',
        backupKey: selectedBackup,
        reason: reason.trim(),
        confirmation: 'RESTORE TO RECOVERY PROJECT',
      },
    });
    if (invokeError || data?.error) {
      setError(unavailableMessage(String(data?.error || invokeError?.message || 'ส่งคำขอกู้คืนไม่สำเร็จ')));
    } else {
      setNotice({ message: 'ส่งคำขอให้ GitHub Actions แล้ว เปิดรายการงานเพื่อตรวจสถานะและอนุมัติขั้นตอน recovery', workflowUrl: data.workflow_url });
      setConfirmation('');
      setReason('');
    }
    setIsRestoring(false);
  }

  return (
    <section className="space-y-5" aria-labelledby="superadmin-backup-title">
      <div className="rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sky-700 text-white"><Database size={22} /></span>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-sky-800">Encrypted Off-site Backup</p>
              <h2 id="superadmin-backup-title" className="mt-1 text-2xl font-black text-slate-950">สำรองและกู้คืนข้อมูลระบบ</h2>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">สำรองฐานข้อมูลและไฟล์ Storage ไป Cloudflare R2 ทุกวัน เวลา 02:17 น. เวลาไทย เข้ารหัสก่อนอัปโหลด และเก็บย้อนหลัง 30 วัน</p>
            </div>
          </div>
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-black text-white disabled:opacity-50" disabled={isLoading} onClick={() => void loadBackups()} type="button">
            <RefreshCw className={isLoading ? 'animate-spin' : ''} size={16} /> ตรวจสถานะล่าสุด
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white bg-white/85 p-4">
            <p className="text-xs font-black text-slate-500">จุดสำรองที่เก็บไว้</p>
            <p className="mt-1 text-lg font-black text-slate-900">{status ? `${status.backups.length} รายการ` : 'ยังไม่ได้ตรวจ'}</p>
          </div>
          <div className="rounded-2xl border border-white bg-white/85 p-4">
            <p className="text-xs font-black text-slate-500">สำรองสำเร็จล่าสุด</p>
            <p className="mt-1 text-sm font-black text-slate-900">{formatDate(status?.backups[0]?.created_at)}</p>
          </div>
          <div className="rounded-2xl border border-white bg-white/85 p-4">
            <p className="text-xs font-black text-slate-500">ระยะเวลาเก็บ</p>
            <p className="mt-1 text-lg font-black text-slate-900">{status ? `${status.retention_days} วัน` : '30 วัน'}</p>
          </div>
        </div>

        {error ? <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800" role="alert">{error}</p> : null}
        {notice ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800" role="status">
            <p>{notice.message}</p>
            {notice.workflowUrl ? <a className="mt-2 inline-flex items-center gap-1 underline" href={notice.workflowUrl} rel="noreferrer" target="_blank">เปิด GitHub Actions <ExternalLink size={13} /></a> : null}
          </div>
        ) : null}

        {status && status.backups.length ? (
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-black text-slate-800"><Clock3 size={16} /> จุดสำรองภายนอก</div>
            <ul className="divide-y divide-slate-100">
              {status.backups.map((backup) => (
                <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm" key={backup.key}>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800">{formatDate(backup.created_at)}</p>
                    <p className="mt-0.5 break-all font-mono text-[11px] text-slate-500">{backup.key}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-500">{formatBytes(backup.size_bytes)}</span>
                    <button className={`rounded-xl px-3 py-2 text-xs font-black ${selectedBackup === backup.key ? 'bg-sky-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`} onClick={() => setSelectedBackup(backup.key)} type="button">
                      {selectedBackup === backup.key ? 'เลือกแล้ว' : 'เลือกกู้คืน'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : status ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-950">
            <p className="flex items-center gap-2 font-black"><AlertTriangle size={17} /> ยังไม่มีไฟล์สำรองใน R2</p>
            <p className="mt-1">ตรวจ GitHub Actions secrets แล้วสั่งงาน “Encrypted off-site database backup” แบบ manual ครั้งแรก</p>
          </div>
        ) : null}

        <p className="mt-4 text-xs font-semibold leading-5 text-slate-600">ฐานข้อมูลและไฟล์ Storage เข้ารหัสด้วย age ก่อนส่งไป bucket แบบ private การสำรองเป็น snapshot รายวัน ไม่ใช่ Point-in-Time Recovery</p>
      </div>

      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm sm:p-7">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800"><HardDrive size={19} /></span>
          <div>
            <h3 className="text-lg font-black text-slate-950">กู้คืนไปยังโปรเจกต์แยกเพื่อตรวจสอบ</h3>
            <p className="mt-1 text-sm font-semibold leading-6 text-amber-950">ระบบจะไม่เขียนทับฐานข้อมูล production โดยตรง GitHub Actions จะนำไฟล์ไปกู้คืนยัง Supabase recovery project ก่อน ให้ตรวจข้อมูลและล็อกอินให้เรียบร้อยก่อนตัดสินใจสลับระบบ</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          <label className="text-xs font-black text-slate-600">เหตุผลในการกู้คืน
            <input className="nexus-field mt-1 h-11 w-full px-3 text-sm" maxLength={300} onChange={(event) => setReason(event.target.value)} placeholder="เช่น ต้องตรวจสอบข้อมูลก่อนวันที่เกิดข้อผิดพลาด" value={reason} />
          </label>
          <label className="text-xs font-black text-slate-600">พิมพ์ “กู้คืนไปยังโปรเจกต์กู้คืน” เพื่อยืนยัน
            <input className="nexus-field mt-1 h-11 w-full px-3 text-sm" onChange={(event) => setConfirmation(event.target.value)} value={confirmation} />
          </label>
        </div>
        <button className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-amber-700 px-5 text-sm font-black text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto" disabled={isRestoring || !selectedBackup || reason.trim().length < 10 || confirmation !== 'กู้คืนไปยังโปรเจกต์กู้คืน'} onClick={() => void requestRestore()} type="button">
          <RotateCcw size={17} /> {isRestoring ? 'กำลังส่งคำขอ…' : 'ส่งคำขอกู้คืน'}
        </button>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-semibold leading-5 text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-2"><ShieldCheck size={15} className="text-emerald-600" /> ดูรายการและส่งคำขอได้เฉพาะ Superadmin; การ restore ทำใน GitHub Actions และตรวจสอบผ่าน workflow</span>
          <p className="mt-2 inline-flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-600" /> ไฟล์สำรองเข้ารหัสก่อนออกจาก runner และลบอัตโนมัติเมื่อเกิน 30 วัน</p>
        </div>
        <a className="inline-flex shrink-0 items-center gap-1 font-black text-sky-800 hover:underline" href="https://github.com/Purinut1997/classcare-360/actions" rel="noreferrer" target="_blank">เปิดประวัติ Workflow <ExternalLink size={13} /></a>
      </div>
    </section>
  );
}
