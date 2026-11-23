import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Cloud,
  ExternalLink,
  FolderOpen,
  HardDrive,
  Info,
  Link2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Unlink,
} from 'lucide-react';

import { formatFileBytes } from '../../lib/imageOptimizer';
import { canManageWorkspace } from '../../lib/roles';
import {
  completeGoogleDriveOAuth,
  disconnectGoogleDrive,
  DRIVE_FOLDER_LABELS,
  getDriveConnectionStatus,
  runColdStorageMigration,
  startGoogleDriveConnect,
  updateDriveSettings,
  type DriveConnectionStatus,
} from '../../lib/storageGateway';
import type { AppSessionContext } from '../../types/core';

interface GoogleDriveStorageCardProps {
  onStatusChange?: (status: DriveConnectionStatus) => void;
  session: AppSessionContext;
}

const FOLDER_PREVIEW_LIST = Array.from(new Set(Object.values(DRIVE_FOLDER_LABELS)));
const OAUTH_CALLBACK_QUERY_KEYS = ['drive_oauth', 'code', 'state', 'scope', 'authuser', 'prompt', 'error'] as const;
const HANDLED_OAUTH_STORAGE_KEY = 'cc360_drive_oauth_handled_code';
const handledOAuthCodes = new Set<string>();

function hasHandledOAuthCode(code: string): boolean {
  if (handledOAuthCodes.has(code)) return true;
  try {
    return typeof window !== 'undefined' && window.sessionStorage.getItem(HANDLED_OAUTH_STORAGE_KEY) === code;
  } catch {
    return false;
  }
}

function markHandledOAuthCode(code: string): void {
  handledOAuthCodes.add(code);
  try {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(HANDLED_OAUTH_STORAGE_KEY, code);
    }
  } catch {
    // Ignore storage access errors in restricted contexts
  }
}

export function GoogleDriveStorageCard({ onStatusChange, session }: GoogleDriveStorageCardProps) {
  const workspaceId = session.workspace?.id || null;
  const isOwner = canManageWorkspace(session.profile.role);
  const [searchParams, setSearchParams] = useSearchParams();

  const [driveStatus, setDriveStatus] = useState<DriveConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isSavingSetting, setIsSavingSetting] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: 'error' | 'info' | 'success' } | null>(null);

  const canonicalRedirectUri = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const url = new URL('/app/dashboard', window.location.origin);
    url.searchParams.set('view', 'workspace-settings');
    url.searchParams.set('drive_oauth', 'callback');
    return url.toString();
  }, []);

  const loadStatus = useCallback(
    async (forceRefresh = false) => {
      if (!workspaceId) {
        setDriveStatus(null);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const next = await getDriveConnectionStatus(workspaceId, forceRefresh);
        setDriveStatus(next);
        onStatusChange?.(next);
      } catch (err) {
        setNotice({
          text: err instanceof Error ? err.message : 'ไม่สามารถโหลดสถานะ Google Drive',
          tone: 'error',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [onStatusChange, workspaceId],
  );

  // Handle Google OAuth callback when redirected back with ?drive_oauth=callback&code=...&state=...
  useEffect(() => {
    if (!workspaceId || searchParams.get('drive_oauth') !== 'callback') return;

    const oauthError = searchParams.get('error');
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    const cleanParams = new URLSearchParams(searchParams);
    OAUTH_CALLBACK_QUERY_KEYS.forEach((key) => cleanParams.delete(key));
    if (cleanParams.get('view') === 'workspace-settings') {
      cleanParams.set('tab', 'storage');
    }
    setSearchParams(cleanParams, { replace: true });

    if (oauthError) {
      setNotice({ text: `ยกเลิกหรือเชื่อมต่อ Google Drive ไม่สำเร็จ (${oauthError})`, tone: 'error' });
      void loadStatus(true);
      return;
    }

    if (!code || !state || hasHandledOAuthCode(code)) {
      void loadStatus(true);
      return;
    }

    markHandledOAuthCode(code);
    setIsConnecting(true);
    setNotice({ text: 'กำลังเชื่อมต่อ Google Drive และสร้างโฟลเดอร์โรงเรียนให้อัตโนมัติ...', tone: 'info' });

    void completeGoogleDriveOAuth(workspaceId, code, state)
      .then((res) => {
        setNotice({
          text: `✓ เชื่อมต่อ Google Drive (${res.googleEmail || 'บัญชีของคุณ'}) พร้อมสร้างโฟลเดอร์ "${res.rootFolderName}" เรียบร้อยแล้ว`,
          tone: 'success',
        });
        return loadStatus(true);
      })
      .catch((err) => {
        const rawMessage = err instanceof Error ? err.message : '';
        const normalized = rawMessage.trim().toLowerCase();
        const friendlyMessage =
          normalized === 'bad request' || normalized.includes('invalid_grant')
            ? 'รหัสยืนยัน Google OAuth หมดอายุหรือถูกใช้งานไปแล้ว กรุณากดเชื่อมต่อใหม่อีกครั้ง'
            : rawMessage || 'แลกสิทธิ์เชื่อมต่อ Google Drive ไม่สำเร็จ';
        setNotice({
          text: friendlyMessage,
          tone: 'error',
        });
        return loadStatus(true);
      })
      .finally(() => {
        setIsConnecting(false);
      });
  }, [loadStatus, searchParams, setSearchParams, workspaceId]);

  useEffect(() => {
    void loadStatus(false);
  }, [loadStatus]);

  async function handleConnect() {
    if (!workspaceId || !isOwner) return;
    setIsConnecting(true);
    setNotice(null);
    try {
      const authUrl = await startGoogleDriveConnect(workspaceId, canonicalRedirectUri);
      window.location.assign(authUrl);
    } catch (err) {
      setIsConnecting(false);
      setNotice({
        text: err instanceof Error ? err.message : 'ไม่สามารถเริ่มเชื่อมต่อ Google Drive ได้',
        tone: 'error',
      });
    }
  }

  async function handleDisconnect() {
    if (!workspaceId || !isOwner) return;
    if (
      !window.confirm(
        'ยืนยันยกเลิกการเชื่อมต่อ Google Drive หรือไม่?\n\nไฟล์เดิมที่อยู่บน Drive ของคุณจะยังคงอยู่ครบถ้วนไม่ถูกลบ ส่วนไฟล์ที่อัปโหลดใหม่หลังจากนี้จะถูกเก็บไว้ในพื้นที่สำรอง Supabase ชั่วคราว',
      )
    ) {
      return;
    }
    setIsSavingSetting(true);
    try {
      await disconnectGoogleDrive(workspaceId);
      setNotice({ text: 'ยกเลิกการเชื่อมต่อ Google Drive แล้ว (ไฟล์เดิมบน Drive ยังคงปลอดภัย)', tone: 'info' });
      await loadStatus(true);
    } catch (err) {
      setNotice({
        text: err instanceof Error ? err.message : 'ยกเลิกการเชื่อมต่อไม่สำเร็จ',
        tone: 'error',
      });
    } finally {
      setIsSavingSetting(false);
    }
  }

  async function handleToggleSetting(key: 'autoBackupEnabled' | 'autoRouteUploads', nextValue: boolean) {
    if (!workspaceId || !isOwner || !driveStatus) return;
    setIsSavingSetting(true);
    try {
      await updateDriveSettings(workspaceId, { [key]: nextValue });
      await loadStatus(true);
      setNotice({ text: 'บันทึกการตั้งค่า Google Drive แล้ว', tone: 'success' });
    } catch (err) {
      setNotice({
        text: err instanceof Error ? err.message : 'อัปเดตการตั้งค่าไม่สำเร็จ',
        tone: 'error',
      });
    } finally {
      setIsSavingSetting(false);
    }
  }

  async function handleMigrateColdStorage() {
    if (!workspaceId || !isOwner) return;
    setIsMigrating(true);
    setNotice({ text: 'กำลังย้ายไฟล์เก่าจากเซิร์ฟเวอร์กลางเข้า Google Drive ของโรงเรียน...', tone: 'info' });
    try {
      let totalMigrated = 0;
      let totalFreed = 0;
      let totalFailed = 0;
      let remaining = 1;
      let rounds = 0;

      // Migrate up to 5 batches (50 files) per click so huge libraries progress rapidly without HTTP timeout
      while (remaining > 0 && rounds < 5) {
        const res = await runColdStorageMigration(workspaceId, 10);
        totalMigrated += res.migrated;
        totalFreed += res.bytesFreed;
        totalFailed += res.failed;
        remaining = res.remaining;
        rounds += 1;
        if (res.migrated === 0) break;
      }

      await loadStatus(true);
      setNotice({
        text:
          totalMigrated > 0
            ? `✓ ย้ายไฟล์เข้า Google Drive แล้ว ${totalMigrated} ไฟล์ (ประหยัดพื้นที่เซิร์ฟเวอร์ ${formatFileBytes(totalFreed)})${remaining > 0 ? ` — คงเหลืออีก ${remaining} ไฟล์ กดซ้ำได้ทันที` : ''}`
            : `ไม่พบไฟล์ที่พร้อมย้าย${totalFailed > 0 ? ` (ข้าม ${totalFailed} ไฟล์)` : ''}`,
        tone: totalMigrated > 0 ? 'success' : 'info',
      });
    } catch (err) {
      setNotice({
        text: err instanceof Error ? err.message : 'ย้ายไฟล์เข้า Google Drive ไม่สำเร็จ',
        tone: 'error',
      });
    } finally {
      setIsMigrating(false);
    }
  }

  const quotaLimit = Number(driveStatus?.storageQuota?.limit || 0);
  const quotaUsage = Number(driveStatus?.storageQuota?.usage || 0);
  const quotaPercent = quotaLimit > 0 ? Math.min(100, Math.round((quotaUsage / quotaLimit) * 100)) : 0;
  const isConnected = driveStatus?.status === 'connected';
  const needsReauth = driveStatus?.status === 'reauth_required';

  return (
    <section className="rounded-3xl border border-[#DCE5DD] bg-white p-5 sm:p-6 shadow-sm">
      {/* Header Row */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-800 ring-1 ring-emerald-200">
              <HardDrive size={13} aria-hidden="true" />
              Google Drive BYOS + Smart WebP
            </span>

            {isLoading ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-500">
                <Loader2 size={11} className="animate-spin" aria-hidden="true" />
                กำลังตรวจสถานะ...
              </span>
            ) : isConnected ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-black text-emerald-900">
                <CheckCircle2 size={12} aria-hidden="true" />
                เชื่อมต่อ Google Drive แล้ว
              </span>
            ) : needsReauth ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-black text-amber-900">
                <AlertTriangle size={12} aria-hidden="true" />
                ต้องยืนยันสิทธิ์ Google Drive ใหม่
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600">
                <Cloud size={12} aria-hidden="true" />
                ใช้พื้นที่สำรอง Supabase (พร้อมเชื่อม Drive)
              </span>
            )}
          </div>

          <h2 className="mt-2.5 font-display text-lg font-black text-slate-950 sm:text-xl">
            คลังเก็บไฟล์และรูปภาพบน Google Drive ของโรงเรียน
          </h2>
          <p className="mt-1 max-w-3xl text-xs font-semibold leading-5 text-slate-600">
            บีบอัดรูปภาพทุกใบเป็น <span className="font-mono font-black text-emerald-700">.webp</span> คมชัดระดับตาเปล่า (ลดขนาดไฟล์ 70–95%)
            แล้วบันทึกลง <strong className="text-slate-800">Google Drive บัญชีใดก็ได้ที่เลือก</strong> (เช่น Gmail โรงเรียน หรือบัญชีส่วนตัวของคุณ) ด้วยสิทธิ์ปลอดภัย{' '}
            <span className="font-mono">drive.file</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={isLoading}
            onClick={() => void loadStatus(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-black text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
            title="รีเฟรชสถานะ Google Drive"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} aria-hidden="true" />
            <span>รีเฟรช</span>
          </button>

          {isOwner ? (
            <>
              <button
                type="button"
                disabled={isConnecting || isSavingSetting || !workspaceId}
                onClick={() => void handleConnect()}
                className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-xs font-black text-white shadow-2xs transition disabled:opacity-50 ${
                  isConnected
                    ? 'bg-slate-900 hover:bg-slate-800'
                    : 'bg-[#1C342B] hover:bg-[#2F7D5B]'
                }`}
              >
                {isConnecting ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                ) : (
                  <Link2 size={14} aria-hidden="true" />
                )}
                <span>
                  {isConnected
                    ? 'เปลี่ยนบัญชี / เชื่อมใหม่'
                    : needsReauth
                      ? 'ยืนยันสิทธิ์ Google Drive ใหม่'
                      : 'เชื่อมต่อ Google Drive'}
                </span>
              </button>

              {isConnected ? (
                <button
                  type="button"
                  disabled={isSavingSetting}
                  onClick={() => void handleDisconnect()}
                  className="inline-flex h-9 items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-black text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                >
                  <Unlink size={13} aria-hidden="true" />
                  <span>ยกเลิกเชื่อม</span>
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {/* Notice */}
      {notice ? (
        <div
          className={`mt-3.5 flex items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-xs font-black ${
            notice.tone === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : notice.tone === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-cyan-200 bg-cyan-50 text-cyan-800'
          }`}
        >
          {notice.tone === 'error' ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
          <span>{notice.text}</span>
        </div>
      ) : null}

      {!isLoading && driveStatus?.bridgeUnavailable ? (
        <div className="mt-3.5 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-bold text-amber-900">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>
            บริการเชื่อมต่อ Google Drive ไม่พร้อมใช้งานชั่วคราว (ระหว่างนี้ระบบจะเก็บไฟล์ในพื้นที่สำรองให้อย่างปลอดภัยอัตโนมัติ)
          </span>
        </div>
      ) : !isLoading && driveStatus && !driveStatus.oauthConfigured && !isConnected ? (
        <div className="mt-3.5 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-bold text-amber-900">
          <Info size={15} className="mt-0.5 shrink-0 text-amber-700" />
          <span>
            ระบบเชื่อมต่อ Google Drive อยู่ระหว่างการเตรียมพร้อมจากผู้ดูแลระบบ (ระหว่างนี้ไฟล์ที่อัปโหลดจะถูกเก็บในพื้นที่สำรองให้อย่างปลอดภัยอัตโนมัติ)
          </span>
        </div>
      ) : driveStatus?.lastError && !notice ? (
        <div className="mt-3.5 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-bold text-amber-900">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>หมายเหตุล่าสุด: {driveStatus.lastError}</span>
        </div>
      ) : null}

      {/* Telemetry Grid */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-[#FAFBF8] p-3.5">
          <p className="text-[11px] font-bold text-slate-500">บัญชี Google Drive ที่เชื่อม</p>
          <p className="mt-1 truncate text-sm font-black text-slate-900">
            {driveStatus?.googleEmail || (isConnected ? 'เชื่อมต่อแล้ว' : 'ยังไม่ได้เชื่อมต่อ')}
          </p>
          {driveStatus?.rootFolderId ? (
            <a
              href={`https://drive.google.com/drive/folders/${encodeURIComponent(driveStatus.rootFolderId)}`}
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-black text-emerald-700 hover:underline"
            >
              <FolderOpen size={12} aria-hidden="true" />
              <span className="truncate">{driveStatus.rootFolderName || 'เปิดโฟลเดอร์บน Drive'}</span>
              <ExternalLink size={11} aria-hidden="true" />
            </a>
          ) : (
            <p className="mt-1 text-[11px] font-medium text-slate-400">
              สร้างโฟลเดอร์ 01–09 ให้อัตโนมัติเมื่อเชื่อม
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-[#FAFBF8] p-3.5">
          <p className="text-[11px] font-bold text-slate-500">พื้นที่ Google Drive ของคุณ</p>
          {quotaLimit > 0 ? (
            <>
              <p className="mt-1 font-mono text-sm font-black text-slate-900">
                {formatFileBytes(quotaUsage)} / {formatFileBytes(quotaLimit)}
              </p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full ${quotaPercent > 85 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                  style={{ width: `${quotaPercent}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] font-bold text-slate-500">ใช้งานแล้ว {quotaPercent}%</p>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm font-black text-slate-900">
                {isConnected ? 'ไม่จำกัด / กำลังซิงก์' : 'รอดึงข้อมูลโควตา'}
              </p>
              <p className="mt-1 text-[11px] font-medium text-slate-400">ใช้พื้นที่ 15 GB+ ของ Google ฟรี</p>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-[#FAFBF8] p-3.5">
          <p className="text-[11px] font-bold text-slate-500">ไฟล์บน Google Drive</p>
          <p className="mt-1 text-sm font-black text-emerald-800">
            {driveStatus?.fileStats.driveCount || 0} ไฟล์ ({formatFileBytes(driveStatus?.fileStats.driveBytes)})
          </p>
          <p className="mt-1 text-[11px] font-medium text-slate-500">
            ปลอดภัยเฉพาะครูและสมาชิกโรงเรียน (Private Proxy)
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-[#FAFBF8] p-3.5">
          <p className="text-[11px] font-bold text-slate-500">ไฟล์บนเซิร์ฟเวอร์กลาง (Supabase)</p>
          <p className="mt-1 text-sm font-black text-slate-900">
            {driveStatus?.fileStats.supabaseCount || 0} ไฟล์ ({formatFileBytes(driveStatus?.fileStats.supabaseBytes)})
          </p>
          {isConnected && isOwner && (driveStatus?.fileStats.migratableCount || 0) > 0 ? (
            <button
              type="button"
              disabled={isMigrating}
              onClick={() => void handleMigrateColdStorage()}
              className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-cyan-600 px-2.5 py-1 text-[10px] font-black text-white transition hover:bg-cyan-700 disabled:opacity-50"
            >
              {isMigrating ? (
                <Loader2 size={11} className="animate-spin" aria-hidden="true" />
              ) : (
                <ArrowRightLeft size={11} aria-hidden="true" />
              )}
              <span>ย้าย {driveStatus?.fileStats.migratableCount} ไฟล์เข้า Drive</span>
            </button>
          ) : (
            <p className="mt-1 text-[11px] font-medium text-slate-400">
              {(driveStatus?.fileStats.migratableCount || 0) === 0
                ? 'ไม่มีไฟล์ค้างที่ต้องย้าย'
                : 'เชื่อม Drive เพื่อย้ายออกได้ 1 คลิก'}
            </p>
          )}
        </div>
      </div>

      {/* Routing & WebP Policy Strip */}
      <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-700">
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              disabled={!isOwner || !isConnected || isSavingSetting}
              checked={Boolean(driveStatus?.autoRouteUploads)}
              onChange={(e) => void handleToggleSetting('autoRouteUploads', e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-50"
            />
            <span>เก็บภาพประจำตัวเด็ก, เยี่ยมบ้าน, ใบลา &amp; เอกสารใหม่ลง Drive อัตโนมัติ</span>
          </label>

          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              disabled={!isOwner || !isConnected || isSavingSetting}
              checked={Boolean(driveStatus?.autoBackupEnabled)}
              onChange={(e) => void handleToggleSetting('autoBackupEnabled', e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-50"
            />
            <span>เปิดใช้ประวัติสำรองข้อมูลลง Drive</span>
          </label>
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-black text-emerald-800 ring-1 ring-emerald-200 shrink-0">
          <Sparkles size={12} aria-hidden="true" />
          <span>Auto Resize + .webp 512px–1600px</span>
        </div>
      </div>

      {/* Auto Folder Map */}
      <div className="mt-3.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
        <ShieldCheck size={13} className="text-emerald-600 shrink-0" aria-hidden="true" />
        <span className="font-bold">โครงสร้างโฟลเดอร์อัตโนมัติ:</span>
        {FOLDER_PREVIEW_LIST.slice(0, 5).map((folder) => (
          <span key={folder} className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700">
            {folder}
          </span>
        ))}
        <span className="text-slate-400">+ อีก {FOLDER_PREVIEW_LIST.length - 5} หมวด</span>
      </div>
    </section>
  );
}
