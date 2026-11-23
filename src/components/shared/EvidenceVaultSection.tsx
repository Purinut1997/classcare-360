import { type ChangeEvent, useCallback, useEffect, useState } from 'react';
import {
  Cloud,
  ExternalLink,
  FileText,
  HardDrive,
  ImagePlus,
  Loader2,
  Paperclip,
  Trash2,
} from 'lucide-react';

import { formatFileBytes, type WebpOptimizeOptions } from '../../lib/imageOptimizer';
import { canWriteWorkspaceData } from '../../lib/roles';
import {
  listStudentEvidence,
  resolveAppFileUrl,
  softDeleteStudentEvidence,
  uploadStudentEvidence,
  type DriveFolderCategory,
  type StudentEvidenceRow,
} from '../../lib/storageGateway';
import type { AppSessionContext } from '../../types/core';

interface EvidenceVaultSectionProps {
  accept?: string;
  compact?: boolean;
  entityId?: string | null;
  moduleKey: DriveFolderCategory;
  optimizePreset?: WebpOptimizeOptions;
  session: AppSessionContext;
  studentId?: string | null;
  subtitle: string;
  title: string;
}

export function EvidenceVaultSection({
  accept = 'image/*,application/pdf',
  compact = false,
  entityId,
  moduleKey,
  optimizePreset,
  session,
  studentId,
  subtitle,
  title,
}: EvidenceVaultSectionProps) {
  const workspaceId = session.workspace?.id || null;
  const canWrite = canWriteWorkspaceData(session.profile.role);

  const [items, setItems] = useState<StudentEvidenceRow[]>([]);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [tableReady, setTableReady] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    if (!workspaceId) {
      setItems([]);
      return;
    }
    setIsLoading(true);
    try {
      const res = await listStudentEvidence({
        entityId,
        moduleKey,
        studentId,
        workspaceId,
      });
      setTableReady(res.tableReady);
      setItems(res.items);

      // Lazily resolve preview URLs for images
      const urlPairs = await Promise.all(
        res.items.slice(0, 12).map(async (item) => {
          if (!item.file) return [item.id, null] as const;
          const url = await resolveAppFileUrl(workspaceId, item.file);
          return [item.id, url] as const;
        }),
      );
      const nextMap: Record<string, string> = {};
      urlPairs.forEach(([id, url]) => {
        if (url) nextMap[id] = url;
      });
      setPreviewUrls(nextMap);
    } catch {
      // Keep UI quiet on transient load issues
    } finally {
      setIsLoading(false);
    }
  }, [entityId, moduleKey, studentId, workspaceId]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  async function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !workspaceId || !canWrite) return;

    setIsUploading(true);
    setNotice(null);
    try {
      const uploaded = await uploadStudentEvidence({
        entityId,
        file,
        moduleKey,
        optimizePreset,
        ownerProfileId: session.profile.id,
        studentId,
        title: file.name,
        workspaceId,
      });

      const savedLabel =
        uploaded.result.savedPercent > 0
          ? ` (แปลง .webp ลดขนาด ${uploaded.result.savedPercent}% เหลือ ${formatFileBytes(uploaded.result.optimizedBytes)})`
          : ` (${formatFileBytes(uploaded.result.sizeBytes)})`;

      const providerLabel =
        uploaded.result.storageProvider === 'google_drive'
          ? 'บันทึกลง Google Drive แล้ว'
          : 'บันทึกในพื้นที่สำรอง Supabase แล้ว';

      setNotice(
        uploaded.tableReady
          ? `✓ ${providerLabel}${savedLabel}`
          : `${providerLabel}${savedLabel} — รัน migration 0098 เพื่อแสดงรายการหลักฐานในระบบ`,
      );
      await loadItems();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'อัปโหลดหลักฐานไม่สำเร็จ');
    } finally {
      setIsUploading(false);
    }
  }

  async function handleOpenFile(item: StudentEvidenceRow) {
    if (!workspaceId) return;
    let url: string | null | undefined = previewUrls[item.id];
    if (!url && item.file) {
      url = await resolveAppFileUrl(workspaceId, item.file);
    }
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else if (item.file?.external_web_view_link) {
      window.open(item.file.external_web_view_link, '_blank', 'noopener,noreferrer');
    }
  }

  async function handleDelete(item: StudentEvidenceRow) {
    if (!workspaceId || !canWrite) return;
    if (!window.confirm(`นำหลักฐาน "${item.title || item.file?.original_filename || 'ไฟล์นี้'}" ออกจากรายการใช่หรือไม่?`)) {
      return;
    }
    try {
      await softDeleteStudentEvidence(workspaceId, item.id);
      setItems((prev) => prev.filter((row) => row.id !== item.id));
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'ลบรายการไม่สำเร็จ');
    }
  }

  return (
    <section
      className={`rounded-3xl border border-[#E5E8E1] bg-white shadow-sm ${
        compact ? 'p-4' : 'p-5'
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-black text-emerald-800 ring-1 ring-emerald-200">
              <Paperclip size={11} aria-hidden="true" />
              คลังหลักฐาน .webp → Google Drive
            </span>
            {items.length > 0 ? (
              <span className="text-[11px] font-bold text-slate-500">{items.length} รายการ</span>
            ) : null}
          </div>
          <h3 className="mt-1.5 text-sm font-black text-slate-950 sm:text-base">{title}</h3>
          <p className="text-xs font-medium text-slate-500">{subtitle}</p>
        </div>

        {canWrite && workspaceId ? (
          <label className="inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#1C342B] px-4 text-xs font-black text-white shadow-2xs transition hover:bg-[#2F7D5B] active:scale-[0.99]">
            {isUploading ? (
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            ) : (
              <ImagePlus size={14} aria-hidden="true" />
            )}
            <span>{isUploading ? 'กำลังแปลง .webp & อัปโหลด...' : 'แนบรูป / เอกสาร (.webp)'}</span>
            <input
              type="file"
              accept={accept}
              disabled={isUploading}
              onChange={(event) => void handleFileSelect(event)}
              className="sr-only"
            />
          </label>
        ) : null}
      </div>

      {notice ? (
        <p className="mt-3 rounded-2xl border border-cyan-200 bg-cyan-50 px-3.5 py-2 text-xs font-black text-cyan-900">
          {notice}
        </p>
      ) : null}

      {!tableReady ? (
        <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-900">
          คลังหลักฐานพร้อมใช้งานหลังรัน migration 0098 (`student_evidence_files`)
        </p>
      ) : null}

      {isLoading ? (
        <div className="mt-4 flex items-center gap-2 text-xs font-bold text-slate-400">
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          <span>กำลังโหลดรายการไฟล์...</span>
        </div>
      ) : items.length > 0 ? (
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const url = previewUrls[item.id];
            const isImage = (item.file?.content_type || '').startsWith('image/');
            const isDrive = item.file?.storage_provider === 'google_drive';

            return (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-[#FAFBF8] p-2.5 transition hover:border-cyan-300"
              >
                <button
                  type="button"
                  onClick={() => void handleOpenFile(item)}
                  className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-400 hover:opacity-90"
                  title="คลิกเพื่อเปิดดูไฟล์"
                >
                  {isImage && url ? (
                    <img src={url} alt={item.title} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <FileText size={20} className="text-cyan-700" aria-hidden="true" />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => void handleOpenFile(item)}
                    className="block w-full truncate text-left text-xs font-black text-slate-900 hover:text-cyan-800"
                    title={item.title || item.file?.original_filename || ''}
                  >
                    {item.title || item.file?.original_filename || 'ไฟล์แนบ'}
                  </button>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-slate-500">
                    <span
                      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.2 ${
                        isDrive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200/70 text-slate-700'
                      }`}
                    >
                      {isDrive ? <HardDrive size={9} /> : <Cloud size={9} />}
                      {isDrive ? 'Drive' : 'Cloud'}
                    </span>
                    <span>{formatFileBytes(item.file?.size_bytes)}</span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void handleOpenFile(item)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-cyan-700"
                    title="เปิดดู"
                  >
                    <ExternalLink size={13} aria-hidden="true" />
                  </button>
                  {canWrite ? (
                    <button
                      type="button"
                      onClick={() => void handleDelete(item)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      title="ลบออก"
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 text-xs font-semibold text-slate-400">
          ยังไม่มีไฟล์แนบในหมวดนี้ — อัปโหลดรูปจากมือถือหรือไฟล์ PDF ได้ทันที ระบบแปลงเป็น .webp อัตโนมัติ
        </p>
      )}
    </section>
  );
}
