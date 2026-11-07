import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Database, ExternalLink, RefreshCw, RotateCcw, ShieldCheck } from 'lucide-react';

import { supabase } from '../../lib/supabaseClient';

interface ManagedBackup {
  id?: number;
  inserted_at?: string;
  is_physical_backup?: boolean;
  status?: string;
}

interface BackupStatus {
  backups: ManagedBackup[];
  physical_backup_data?: {
    earliest_physical_backup_date_unix?: number | null;
    latest_physical_backup_date_unix?: number | null;
  } | null;
  pitr_enabled: boolean;
  region?: string;
  walg_enabled?: boolean;
  schedule?: { schedule_for?: string; updated_at?: string } | null;
  schedule_available?: boolean;
}

function formatDate(value?: string | number | null) {
  if (value === null || value === undefined) return '—';
  const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function toLocalDateTimeInput(unixSeconds?: number | null) {
  if (!unixSeconds) return undefined;
  const date = new Date(unixSeconds * 1000);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function SuperadminBackupCenter() {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [recoveryTime, setRecoveryTime] = useState('');
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [backupTime, setBackupTime] = useState('04:00');
  const [scheduleReason, setScheduleReason] = useState('');
  const [scheduleConfirmation, setScheduleConfirmation] = useState('');
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  const loadBackupStatus = useCallback(async () => {
    if (!supabase) {
      setError('ยังไม่ได้เชื่อมต่อ Supabase');
      return;
    }
    setIsLoading(true);
    setError(null);
    setNotice(null);
    const { data, error: invokeError } = await supabase.functions.invoke('system-backup-control', { body: { action: 'status' } });
    if (invokeError) {
      const message = invokeError.message.toLowerCase();
      setError(message.includes('404') || message.includes('not found') || message.includes('failed to send a request')
        ? 'ยังเชื่อมต่อ Edge Function system-backup-control ไม่ได้ ตรวจพบว่า endpoint ยังไม่พร้อมใช้งาน ให้ deploy Function ใน Supabase ก่อน แล้วตั้งค่า SUPABASE_PROJECT_REF และ SUPABASE_ACCESS_TOKEN ใน Edge Function Secrets'
        : `เรียก Edge Function ไม่สำเร็จ: ${invokeError.message}`);
      setIsLoading(false);
      return;
    }
    if (data?.error) {
      setError(String(data.error));
      setIsLoading(false);
      return;
    }
    setStatus(data as BackupStatus);
    if (data?.schedule?.schedule_for) setBackupTime(String(data.schedule.schedule_for).slice(0, 5));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadBackupStatus();
  }, [loadBackupStatus]);

  async function requestPitrRestore() {
    if (!supabase || !status?.pitr_enabled || !recoveryTime || !reason.trim() || confirmation !== 'กู้คืนฐานข้อมูล') return;
    const targetUnix = Math.floor(new Date(recoveryTime).getTime() / 1000);
    if (!Number.isFinite(targetUnix)) {
      setError('วันและเวลาที่เลือกไม่ถูกต้อง');
      return;
    }
    const approved = window.confirm(
      `ยืนยันส่งคำขอให้ Supabase กู้คืนฐานข้อมูลทั้งโปรเจกต์ไปยัง ${formatDate(targetUnix)}?\n\nการเปลี่ยนแปลงหลังเวลานั้นจะหายไป และเว็บอาจใช้งานไม่ได้ระหว่างกู้คืน`,
    );
    if (!approved) return;

    setIsRestoring(true);
    setError(null);
    setNotice(null);
    const { data, error: invokeError } = await supabase.functions.invoke('system-backup-control', {
      body: {
        action: 'restore-pitr',
        confirmation: 'ROLLBACK PRODUCTION',
        reason: reason.trim(),
        recoveryTimeTargetUnix: targetUnix,
      },
    });
    if (invokeError || data?.error) {
      setError(String(data?.error || invokeError?.message || 'ส่งคำขอกู้คืนไม่สำเร็จ'));
    } else {
      setNotice(`Supabase รับคำขอกู้คืนแล้ว (${formatDate(targetUnix)}) ตรวจสอบสถานะงานใน Supabase Dashboard ก่อนเปิดระบบให้ผู้ใช้`);
      setConfirmation('');
    }
    setIsRestoring(false);
  }

  async function updateBackupSchedule() {
    if (!supabase || !status?.schedule_available || scheduleConfirmation !== 'เปลี่ยนเวลาสำรองข้อมูล' || scheduleReason.trim().length < 10) return;
    const approved = window.confirm(`ยืนยันเปลี่ยนเวลาสำรองฐานข้อมูลรายวันเป็น ${backupTime} น. (เวลา UTC)? มีผลในรอบสำรองถัดไป และเปลี่ยนได้ไม่เกิน 3 ครั้งใน 24 ชั่วโมง`);
    if (!approved) return;
    setIsSavingSchedule(true);
    setError(null);
    setNotice(null);
    const { data, error: invokeError } = await supabase.functions.invoke('system-backup-control', {
      body: { action: 'update-schedule', scheduleFor: `${backupTime}:00`, reason: scheduleReason.trim(), confirmation: 'UPDATE BACKUP SCHEDULE' },
    });
    if (invokeError || data?.error) {
      setError(String(data?.error || invokeError?.message || 'เปลี่ยนเวลาสำรองข้อมูลไม่สำเร็จ'));
    } else {
      setStatus((current) => current ? { ...current, schedule: data.schedule } : current);
      setNotice(`อัปเดตเวลาสำรองข้อมูลเป็น ${backupTime} น. (UTC) แล้ว`);
      setScheduleConfirmation('');
      setScheduleReason('');
    }
    setIsSavingSchedule(false);
  }

  const orderedBackups = [...(status?.backups || [])].sort((a, b) => Date.parse(b.inserted_at || '') - Date.parse(a.inserted_at || ''));

  return (
    <section className="space-y-5" aria-labelledby="superadmin-backup-title">
      <div className="rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sky-700 text-white"><Database size={22} /></span>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-sky-800">Disaster Recovery</p>
              <h2 id="superadmin-backup-title" className="mt-1 text-2xl font-black text-slate-950">สำรองและกู้คืนฐานข้อมูลระบบ</h2>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">ดูสถานะ backup ที่ Supabase จัดการ และกู้คืนแบบ Point-in-Time ได้เมื่อโปรเจกต์เปิดใช้ PITR</p>
            </div>
          </div>
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-black text-white disabled:opacity-50" disabled={isLoading} onClick={() => void loadBackupStatus()} type="button">
            <RefreshCw className={isLoading ? 'animate-spin' : ''} size={16} /> ตรวจสถานะล่าสุด
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white bg-white/85 p-4">
            <p className="text-xs font-black text-slate-500">Database backup</p>
            <p className="mt-1 text-lg font-black text-slate-900">{status ? (orderedBackups.length ? `${orderedBackups.length} จุดสำรองที่ API แสดง` : 'ไม่พบ backup') : 'ยังไม่ได้ตรวจ'}</p>
          </div>
          <div className="rounded-2xl border border-white bg-white/85 p-4">
            <p className="text-xs font-black text-slate-500">Point-in-Time Recovery</p>
            <p className={`mt-1 text-lg font-black ${status?.pitr_enabled ? 'text-emerald-700' : 'text-amber-700'}`}>{status ? (status.pitr_enabled ? 'เปิดใช้งาน' : 'ยังไม่เปิด') : 'ยังไม่ได้ตรวจ'}</p>
          </div>
          <div className="rounded-2xl border border-white bg-white/85 p-4">
            <p className="text-xs font-black text-slate-500">ช่วงเวลาที่เลือกกู้คืนได้</p>
            <p className="mt-1 text-sm font-black leading-5 text-slate-900">{formatDate(status?.physical_backup_data?.earliest_physical_backup_date_unix)} – {formatDate(status?.physical_backup_data?.latest_physical_backup_date_unix)}</p>
          </div>
        </div>

        {status ? (
          <div className="mt-5 rounded-2xl border border-indigo-200 bg-indigo-50/80 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-black text-indigo-950">ตั้งเวลาสำรองรายวัน</p>
                {status.schedule_available ? (
                  <p className="mt-1 text-sm font-semibold text-indigo-900">เวลาปัจจุบัน {status.schedule?.schedule_for || 'ยังไม่ได้ระบุ'} UTC {status.schedule?.updated_at ? `· ปรับล่าสุด ${formatDate(status.schedule.updated_at)}` : ''}</p>
                ) : (
                  <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-indigo-900">แพ็กเกจนี้อ่านหรือปรับเวลา backup ผ่าน API ไม่ได้ ฟีเจอร์ตั้งเวลาในเว็บรองรับเฉพาะ Supabase Enterprise; Pro และ Team ยังสำรองอัตโนมัติทุกวันตามเวลาที่ Supabase กำหนด</p>
                )}
              </div>
              {status.schedule_available ? <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-indigo-800">เปลี่ยนได้สูงสุด 3 ครั้ง / 24 ชม.</span> : null}
            </div>
            {status.schedule_available ? (
              <div className="mt-4 grid gap-3 md:grid-cols-[170px_1fr]">
                <label className="text-xs font-black text-indigo-950">เวลา (UTC)
                  <input className="nexus-field mt-1 h-11 w-full px-3 text-sm" onChange={(event) => setBackupTime(event.target.value)} type="time" value={backupTime} />
                </label>
                <label className="text-xs font-black text-indigo-950">เหตุผลในการเปลี่ยนเวลา
                  <input className="nexus-field mt-1 h-11 w-full px-3 text-sm" maxLength={300} onChange={(event) => setScheduleReason(event.target.value)} placeholder="เช่น ย้ายรอบสำรองออกจากช่วงใช้งานสูงสุด" value={scheduleReason} />
                </label>
                <label className="text-xs font-black text-indigo-950 md:col-span-2">พิมพ์ “เปลี่ยนเวลาสำรองข้อมูล” เพื่อยืนยัน
                  <input className="nexus-field mt-1 h-11 w-full px-3 text-sm" onChange={(event) => setScheduleConfirmation(event.target.value)} value={scheduleConfirmation} />
                </label>
                <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 text-sm font-black text-white disabled:opacity-40 md:col-span-2 md:justify-self-start" disabled={isSavingSchedule || scheduleReason.trim().length < 10 || scheduleConfirmation !== 'เปลี่ยนเวลาสำรองข้อมูล'} onClick={() => void updateBackupSchedule()} type="button">
                  <Clock3 size={16} /> {isSavingSchedule ? 'กำลังอัปเดต…' : 'บันทึกเวลาสำรองข้อมูล'}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800" role="alert">{error}</p> : null}
        {notice ? <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800" role="status">{notice}</p> : null}

        {status && orderedBackups.length > 0 ? (
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-black text-slate-800"><Clock3 size={16} /> Backup ที่ Supabase รายงาน</div>
            <ul className="divide-y divide-slate-100">
              {orderedBackups.slice(0, 12).map((backup, index) => (
                <li className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm" key={`${backup.id ?? index}-${backup.inserted_at}`}>
                  <span className="font-bold text-slate-700">{formatDate(backup.inserted_at)}</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">{backup.status || 'unknown'} · {backup.is_physical_backup ? 'physical' : 'logical'}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="mt-4 text-xs font-semibold leading-5 text-slate-600">ตารางนี้อ่านสถานะจาก Supabase Management API โดยตรง การสำรองรายวันขึ้นกับแพ็กเกจของโปรเจกต์ และ backup ฐานข้อมูลไม่รวมไฟล์จริงใน Storage bucket</p>
      </div>

      {status?.pitr_enabled ? (
        <div className="rounded-3xl border border-rose-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-700"><AlertTriangle size={19} /></span>
            <div>
              <h3 className="text-lg font-black text-slate-950">กู้คืนฐานข้อมูลทั้งโปรเจกต์</h3>
              <p className="mt-1 text-sm font-semibold leading-6 text-rose-800">เป็นการย้อนฐานข้อมูลจริง ไม่ใช่เฉพาะ Workspace: ข้อมูลหลังเวลาที่เลือกจะถูกทิ้ง และระบบอาจหยุดให้บริการระหว่างดำเนินการ แนะนำให้ใช้เมื่อเกิดเหตุร้ายแรงเท่านั้น</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            <label className="text-xs font-black text-slate-600">เวลาที่ต้องการย้อนกลับ (เวลาท้องถิ่น)
              <input className="nexus-field mt-1 h-11 w-full px-3 text-sm" max={toLocalDateTimeInput(status.physical_backup_data?.latest_physical_backup_date_unix)} min={toLocalDateTimeInput(status.physical_backup_data?.earliest_physical_backup_date_unix)} onChange={(event) => setRecoveryTime(event.target.value)} type="datetime-local" value={recoveryTime} />
            </label>
            <label className="text-xs font-black text-slate-600">เหตุผลในการกู้คืน
              <input className="nexus-field mt-1 h-11 w-full px-3 text-sm" maxLength={300} onChange={(event) => setReason(event.target.value)} placeholder="เช่น ข้อมูลคะแนนถูกแก้ผิดเป็นวงกว้าง" value={reason} />
            </label>
          </div>
          <label className="mt-3 block text-xs font-black text-slate-600">พิมพ์ “กู้คืนฐานข้อมูล” เพื่อยืนยัน
            <input className="nexus-field mt-1 h-11 w-full px-3 text-sm" onChange={(event) => setConfirmation(event.target.value)} value={confirmation} />
          </label>
          <button className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-rose-700 px-5 text-sm font-black text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-40" disabled={isRestoring || !recoveryTime || reason.trim().length < 10 || confirmation !== 'กู้คืนฐานข้อมูล'} onClick={() => void requestPitrRestore()} type="button">
            <RotateCcw size={17} /> {isRestoring ? 'กำลังส่งคำขอ…' : 'ส่งคำขอย้อนฐานข้อมูลระบบ'}
          </button>
        </div>
      ) : status ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold leading-6 text-amber-950">
          <p className="flex items-center gap-2 font-black"><ShieldCheck size={17} /> ยังไม่เปิด PITR</p>
          <p className="mt-2">Superadmin ยังเรียกย้อนกลับตามวินาทีผ่านหน้านี้ไม่ได้ หากเป็นแพ็กเกจที่มี Daily backup ให้ใช้ Database → Backups ใน Supabase Dashboard เพื่อคืนจากจุดสำรองรายวัน การเปิด PITR อาจมีค่าใช้จ่ายเพิ่มเติมและแทนที่ daily backup ตามการตั้งค่าของ Supabase</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-semibold leading-5 text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-600" /> restore requests are restricted to Superadmin and recorded in Edge Function logs</span>
          <p className="mt-2">หมายเหตุ: Supabase Free ไม่มี daily database backup อัตโนมัติ หากใช้ Free ต้องมีระบบส่งออก backup ไปเก็บภายนอกหรืออัปเกรดแพ็กเกจที่รองรับ</p>
        </div>
        <a className="inline-flex shrink-0 items-center gap-1 font-black text-sky-800 hover:underline" href="https://supabase.com/dashboard" rel="noreferrer" target="_blank">เปิด Supabase Dashboard <ExternalLink size={13} /></a>
      </div>
    </section>
  );
}
