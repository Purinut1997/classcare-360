import { appEnv } from './env';
import {
  convertImageToWebpWithStats,
  type WebpOptimizeOptions,
} from './imageOptimizer';
import { isSupabaseReady, supabase } from './supabaseClient';

export type DriveFolderCategory =
  | 'student_avatar'
  | 'home_visit'
  | 'attendance_leave'
  | 'behavior_portfolio'
  | 'omr_score_scan'
  | 'daily_brief'
  | 'health_doc'
  | 'savings_slip'
  | 'official_document'
  | 'workspace_backup';

export type StorageProviderKind = 'supabase' | 'google_drive';

export interface DriveFileStats {
  driveBytes: number;
  driveCount: number;
  migratableCount: number;
  supabaseBytes: number;
  supabaseCount: number;
}

export interface DriveQuotaInfo {
  limit?: string;
  usage?: string;
  usageInDrive?: string;
  usageInDriveTrash?: string;
}

export interface DriveConnectionStatus {
  autoBackupEnabled: boolean;
  autoRouteUploads: boolean;
  bridgeUnavailable?: boolean;
  connectedAt: string | null;
  fileStats: DriveFileStats;
  googleEmail: string | null;
  lastError: string | null;
  lastSyncedAt: string | null;
  oauthConfigured: boolean;
  rootFolderId: string | null;
  rootFolderName: string | null;
  status: 'connected' | 'disconnected' | 'reauth_required' | 'error';
  storageQuota: DriveQuotaInfo | null;
  subfolders: Record<string, string>;
}

export interface StoredFileResult {
  contentType: string;
  externalFileId?: string | null;
  externalFolderId?: string | null;
  externalWebViewLink?: string | null;
  fileId: string;
  optimizedBytes: number;
  originalBytes: number;
  savedPercent: number;
  sizeBytes: number;
  storagePath: string;
  storageProvider: StorageProviderKind;
}

export interface AppFileLookupRow {
  bucket: string;
  content_type?: string | null;
  external_file_id?: string | null;
  external_web_view_link?: string | null;
  id: string;
  original_filename?: string | null;
  size_bytes?: number | null;
  storage_path: string;
  storage_provider?: StorageProviderKind | null;
}

export interface DriveBackupItem {
  created_at: string;
  external_web_view_link: string | null;
  id: string;
  original_filename: string | null;
  size_bytes: number | null;
  storage_provider: StorageProviderKind | null;
}

export interface StudentEvidenceRow {
  created_at: string;
  entity_id: string | null;
  file: AppFileLookupRow | null;
  file_id: string;
  id: string;
  module_key: DriveFolderCategory;
  note: string | null;
  student_id: string | null;
  title: string;
}

export const DRIVE_FOLDER_LABELS: Record<DriveFolderCategory, string> = {
  student_avatar: '01_ภาพประจำตัวนักเรียน',
  home_visit: '02_เยี่ยมบ้านและดูแลช่วยเหลือ',
  attendance_leave: '03_ใบลาและหลักฐานเวลาเรียน',
  behavior_portfolio: '04_พฤติกรรมและเกียรติบัตรผลงาน',
  omr_score_scan: '05_สแกน_OMR_และใบคะแนน_AI',
  daily_brief: '06_กิจกรรมและรายงานประจำวัน',
  health_doc: '07_สุขภาพและเงินออม',
  savings_slip: '07_สุขภาพและเงินออม',
  official_document: '08_เอกสารราชการ_ปพ5_ปพ6',
  workspace_backup: '09_สำรองข้อมูลอัตโนมัติ',
};

const EMPTY_FILE_STATS: DriveFileStats = {
  driveBytes: 0,
  driveCount: 0,
  migratableCount: 0,
  supabaseBytes: 0,
  supabaseCount: 0,
};

const DEFAULT_STATUS: DriveConnectionStatus = {
  autoBackupEnabled: false,
  autoRouteUploads: true,
  bridgeUnavailable: false,
  connectedAt: null,
  fileStats: EMPTY_FILE_STATS,
  googleEmail: null,
  lastError: null,
  lastSyncedAt: null,
  oauthConfigured: false,
  rootFolderId: null,
  rootFolderName: null,
  status: 'disconnected',
  storageQuota: null,
  subfolders: {},
};

const statusCache = new Map<string, { expiresAt: number; value: DriveConnectionStatus }>();
const resolvedUrlCache = new Map<string, { expiresAt: number; isObjectUrl: boolean; url: string }>();

function getBridgeEndpoint() {
  return `${appEnv.supabaseUrl.replace(/\/+$/, '')}/functions/v1/google-drive-bridge`;
}

async function getAuthHeaders(): Promise<Record<string, string> | null> {
  if (!isSupabaseReady || !supabase || !appEnv.supabaseUrl || !appEnv.supabaseAnonKey) return null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return null;

  return {
    Authorization: `Bearer ${session.access_token}`,
    apikey: appEnv.supabaseAnonKey,
  };
}

async function invokeBridgeJson<T>(payload: Record<string, unknown>): Promise<T> {
  const headers = await getAuthHeaders();
  if (!headers) {
    throw new Error('ยังไม่ได้เข้าสู่ระบบ Supabase');
  }

  const response = await fetch(getBridgeEndpoint(), {
    body: JSON.stringify(payload),
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error || `Google Drive bridge failed (${response.status})`);
  }
  return data;
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    for (let j = 0; j < slice.length; j += 1) {
      binary += String.fromCharCode(slice[j]);
    }
  }
  return btoa(binary);
}

function isMissingColumnOrTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return (
    error.code === '42703' ||
    error.code === '42P01' ||
    error.code === 'PGRST204' ||
    error.code === 'PGRST205' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the') ||
    msg.includes('schema cache')
  );
}

export function invalidateDriveStatusCache(workspaceId?: string) {
  if (workspaceId) {
    statusCache.delete(workspaceId);
  } else {
    statusCache.clear();
  }
}

export async function getDriveConnectionStatus(
  workspaceId: string | null | undefined,
  forceRefresh = false,
): Promise<DriveConnectionStatus> {
  if (!workspaceId || !isSupabaseReady || !supabase) {
    return { ...DEFAULT_STATUS };
  }

  const cached = statusCache.get(workspaceId);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const result = await invokeBridgeJson<DriveConnectionStatus>({
      action: 'status',
      workspaceId,
    });
    const normalized: DriveConnectionStatus = {
      ...DEFAULT_STATUS,
      ...result,
      bridgeUnavailable: false,
      fileStats: result.fileStats || EMPTY_FILE_STATS,
    };
    statusCache.set(workspaceId, { expiresAt: Date.now() + 60_000, value: normalized });
    return normalized;
  } catch (err) {
    // Graceful fallback if Edge Function isn't deployed yet: still try reading non-secret DB table & file count
    let fallbackConn: Record<string, unknown> | null = null;
    try {
      const { data } = await supabase
        .from('workspace_drive_connections')
        .select('status,google_email,root_folder_id,root_folder_name,auto_route_uploads,auto_backup_enabled,last_error,last_synced_at,connected_at')
        .eq('workspace_id', workspaceId)
        .maybeSingle();
      fallbackConn = (data as Record<string, unknown> | null) || null;
    } catch {
      fallbackConn = null;
    }

    const fallbackValue: DriveConnectionStatus = {
      ...DEFAULT_STATUS,
      autoBackupEnabled: Boolean(fallbackConn?.auto_backup_enabled),
      autoRouteUploads: fallbackConn ? Boolean(fallbackConn.auto_route_uploads) : true,
      bridgeUnavailable: true,
      connectedAt: (fallbackConn?.connected_at as string | null) || null,
      googleEmail: (fallbackConn?.google_email as string | null) || null,
      lastError:
        (fallbackConn?.last_error as string | null) ||
        (err instanceof Error ? err.message : null),
      lastSyncedAt: (fallbackConn?.last_synced_at as string | null) || null,
      rootFolderId: (fallbackConn?.root_folder_id as string | null) || null,
      rootFolderName: (fallbackConn?.root_folder_name as string | null) || null,
      status:
        (fallbackConn?.status as DriveConnectionStatus['status'] | undefined) || 'disconnected',
    };

    statusCache.set(workspaceId, { expiresAt: Date.now() + 25_000, value: fallbackValue });
    return fallbackValue;
  }
}

export async function startGoogleDriveConnect(workspaceId: string, redirectUri: string): Promise<string> {
  const result = await invokeBridgeJson<{ authUrl: string }>({
    action: 'get-auth-url',
    redirectUri,
    workspaceId,
  });
  return result.authUrl;
}

export async function completeGoogleDriveOAuth(workspaceId: string, code: string, state: string) {
  const result = await invokeBridgeJson<{
    connected: boolean;
    googleEmail: string | null;
    rootFolderId: string;
    rootFolderName: string;
  }>({
    action: 'exchange-code',
    code,
    state,
    workspaceId,
  });
  invalidateDriveStatusCache(workspaceId);
  return result;
}

export async function updateDriveSettings(
  workspaceId: string,
  patch: { autoBackupEnabled?: boolean; autoRouteUploads?: boolean },
) {
  await invokeBridgeJson<{ ok: boolean }>({
    action: 'update-settings',
    ...patch,
    workspaceId,
  });
  invalidateDriveStatusCache(workspaceId);
}

export async function disconnectGoogleDrive(workspaceId: string) {
  await invokeBridgeJson<{ status: string }>({
    action: 'disconnect',
    workspaceId,
  });
  invalidateDriveStatusCache(workspaceId);
}

export async function runColdStorageMigration(workspaceId: string, limit = 10) {
  const result = await invokeBridgeJson<{
    bytesFreed: number;
    failed: number;
    migrated: number;
    remaining: number;
  }>({
    action: 'migrate-batch',
    limit,
    workspaceId,
  });
  invalidateDriveStatusCache(workspaceId);
  return result;
}

export async function listDriveBackups(workspaceId: string): Promise<DriveBackupItem[]> {
  try {
    const result = await invokeBridgeJson<{ backups: DriveBackupItem[] }>({
      action: 'list-backups',
      workspaceId,
    });
    return result.backups || [];
  } catch {
    if (!isSupabaseReady || !supabase) return [];
    const { data } = await supabase
      .from('app_files')
      .select('id,original_filename,size_bytes,storage_provider,external_web_view_link,created_at')
      .eq('workspace_id', workspaceId)
      .eq('folder_category', 'workspace_backup')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(20);
    return (data as DriveBackupItem[] | null) || [];
  }
}

export interface UploadWorkspaceFileParams {
  category: DriveFolderCategory;
  fallbackBucket: string;
  file: File;
  forceProvider?: StorageProviderKind;
  metadata?: Record<string, unknown>;
  optimizePreset?: WebpOptimizeOptions;
  ownerProfileId: string;
  privacyLevel?: 'public' | 'private' | 'restricted' | 'sensitive';
  storagePath: string;
  workspaceId: string;
}

export async function uploadWorkspaceFile({
  category,
  fallbackBucket,
  file,
  forceProvider,
  metadata = {},
  optimizePreset,
  ownerProfileId,
  privacyLevel = 'sensitive',
  storagePath,
  workspaceId,
}: UploadWorkspaceFileParams): Promise<StoredFileResult> {
  if (!isSupabaseReady || !supabase) {
    throw new Error('ระบบยังไม่ได้เชื่อมต่อ Supabase');
  }

  const optimized = optimizePreset
    ? await convertImageToWebpWithStats(file, optimizePreset)
    : {
        file,
        optimizedBytes: file.size,
        originalBytes: file.size,
        savedPercent: 0,
        wasConverted: false,
      };

  const preparedFile = optimized.file;
  const enrichedMetadata: Record<string, unknown> = {
    ...metadata,
    folder_category: category,
    optimized_content_type: preparedFile.type || null,
    optimized_filename: preparedFile.name,
    optimized_size_bytes: optimized.optimizedBytes,
    original_size_bytes: optimized.originalBytes,
    resized_for_storage: optimized.wasConverted,
    saved_percent: optimized.savedPercent,
  };

  let shouldTryDrive = forceProvider === 'google_drive';
  if (!forceProvider) {
    const driveStatus = await getDriveConnectionStatus(workspaceId);
    shouldTryDrive =
      !driveStatus.bridgeUnavailable &&
      driveStatus.status === 'connected' &&
      driveStatus.autoRouteUploads;
  }

  if (shouldTryDrive) {
    try {
      const base64Data = await fileToBase64(preparedFile);
      const uploaded = await invokeBridgeJson<{
        contentType: string;
        externalFileId: string;
        externalFolderId: string;
        externalWebViewLink: string;
        fileId: string;
        sizeBytes: number;
        storagePath: string;
        storageProvider: 'google_drive';
      }>({
        action: 'upload',
        base64Data,
        category,
        contentType: preparedFile.type || 'application/octet-stream',
        fallbackBucket,
        fileName: preparedFile.name,
        metadata: enrichedMetadata,
        privacyLevel,
        storagePath,
        workspaceId,
      });

      invalidateDriveStatusCache(workspaceId);

      return {
        contentType: uploaded.contentType || preparedFile.type || 'application/octet-stream',
        externalFileId: uploaded.externalFileId,
        externalFolderId: uploaded.externalFolderId,
        externalWebViewLink: uploaded.externalWebViewLink,
        fileId: uploaded.fileId,
        optimizedBytes: optimized.optimizedBytes,
        originalBytes: optimized.originalBytes,
        savedPercent: optimized.savedPercent,
        sizeBytes: uploaded.sizeBytes || preparedFile.size,
        storagePath: uploaded.storagePath,
        storageProvider: 'google_drive',
      };
    } catch (driveErr) {
      if (forceProvider === 'google_drive') {
        throw driveErr;
      }
      // Otherwise transparently fall back to Supabase Storage below so uploads never fail mid-class
    }
  }

  const { error: uploadError } = await supabase.storage
    .from(fallbackBucket)
    .upload(storagePath, preparedFile, {
      contentType: preparedFile.type || 'application/octet-stream',
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const baseInsert = {
    bucket: fallbackBucket,
    content_type: preparedFile.type || 'application/octet-stream',
    metadata: enrichedMetadata,
    original_filename: preparedFile.name,
    owner_profile_id: ownerProfileId,
    privacy_level: privacyLevel,
    size_bytes: preparedFile.size,
    storage_path: storagePath,
    workspace_id: workspaceId,
  };

  let insertRes = await supabase
    .from('app_files')
    .insert({
      ...baseInsert,
      folder_category: category,
      storage_provider: 'supabase',
    })
    .select('id,storage_path,size_bytes')
    .single();

  if (insertRes.error && isMissingColumnOrTableError(insertRes.error)) {
    insertRes = await supabase
      .from('app_files')
      .insert(baseInsert)
      .select('id,storage_path,size_bytes')
      .single();
  }

  if (insertRes.error || !insertRes.data) {
    throw insertRes.error || new Error('บันทึกข้อมูลไฟล์ใน app_files ไม่สำเร็จ');
  }

  invalidateDriveStatusCache(workspaceId);

  return {
    contentType: preparedFile.type || 'application/octet-stream',
    fileId: insertRes.data.id,
    optimizedBytes: optimized.optimizedBytes,
    originalBytes: optimized.originalBytes,
    savedPercent: optimized.savedPercent,
    sizeBytes: insertRes.data.size_bytes || preparedFile.size,
    storagePath: insertRes.data.storage_path,
    storageProvider: 'supabase',
  };
}

export async function resolveAppFileUrl(
  workspaceId: string | null | undefined,
  fileOrId: AppFileLookupRow | string | null | undefined,
): Promise<string | null> {
  if (!workspaceId || !fileOrId || !isSupabaseReady || !supabase) return null;

  let record: AppFileLookupRow | null = null;
  if (typeof fileOrId === 'string') {
    const cacheKey = `${workspaceId}:${fileOrId}`;
    const cached = resolvedUrlCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.url;
    }

    let queryRes = await supabase
      .from('app_files')
      .select('id,bucket,storage_path,storage_provider,external_file_id,external_web_view_link,original_filename,content_type,size_bytes')
      .eq('id', fileOrId)
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .maybeSingle();

    if (queryRes.error && isMissingColumnOrTableError(queryRes.error)) {
      queryRes = await supabase
        .from('app_files')
        .select('id,bucket,storage_path,original_filename,content_type,size_bytes')
        .eq('id', fileOrId)
        .eq('workspace_id', workspaceId)
        .is('deleted_at', null)
        .maybeSingle();
    }

    if (queryRes.error || !queryRes.data) return null;
    record = queryRes.data as AppFileLookupRow;
  } else {
    record = fileOrId;
  }

  const cacheKey = `${workspaceId}:${record.id}`;
  const cached = resolvedUrlCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  if (record.storage_provider === 'google_drive' && record.external_file_id) {
    try {
      const headers = await getAuthHeaders();
      if (!headers) return null;

      const res = await fetch(getBridgeEndpoint(), {
        body: JSON.stringify({
          action: 'download',
          fileId: record.id,
          workspaceId,
        }),
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });

      if (!res.ok) return null;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) return null;

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      resolvedUrlCache.set(cacheKey, {
        expiresAt: Date.now() + 20 * 60_000,
        isObjectUrl: true,
        url: objectUrl,
      });
      return objectUrl;
    } catch {
      return null;
    }
  }

  const { data: signed, error: signedError } = await supabase.storage
    .from(record.bucket)
    .createSignedUrl(record.storage_path, 60 * 30);

  if (signedError || !signed?.signedUrl) return null;
  resolvedUrlCache.set(cacheKey, {
    expiresAt: Date.now() + 20 * 60_000,
    isObjectUrl: false,
    url: signed.signedUrl,
  });
  return signed.signedUrl;
}

export async function listStudentEvidence(params: {
  entityId?: string | null;
  moduleKey: DriveFolderCategory;
  studentId?: string | null;
  workspaceId: string;
}): Promise<{ items: StudentEvidenceRow[]; tableReady: boolean }> {
  if (!isSupabaseReady || !supabase) return { items: [], tableReady: false };

  let query = supabase
    .from('student_evidence_files')
    .select(
      'id,workspace_id,student_id,file_id,module_key,entity_id,title,note,created_at,file:app_files!student_evidence_files_file_workspace_fkey(id,bucket,storage_path,storage_provider,external_file_id,external_web_view_link,original_filename,content_type,size_bytes)',
    )
    .eq('workspace_id', params.workspaceId)
    .eq('module_key', params.moduleKey)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(40);

  if (params.studentId) {
    query = query.eq('student_id', params.studentId);
  }
  if (params.entityId) {
    query = query.eq('entity_id', params.entityId);
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingColumnOrTableError(error)) {
      return { items: [], tableReady: false };
    }
    throw error;
  }

  const normalized: StudentEvidenceRow[] = (data || []).map((row) => {
    const rawFile = Array.isArray(row.file) ? row.file[0] : row.file;
    return {
      created_at: String(row.created_at),
      entity_id: (row.entity_id as string | null) || null,
      file: (rawFile as AppFileLookupRow | null) || null,
      file_id: String(row.file_id),
      id: String(row.id),
      module_key: row.module_key as DriveFolderCategory,
      note: (row.note as string | null) || null,
      student_id: (row.student_id as string | null) || null,
      title: String(row.title || ''),
    };
  });

  return { items: normalized, tableReady: true };
}

export async function uploadStudentEvidence(params: {
  entityId?: string | null;
  file: File;
  moduleKey: DriveFolderCategory;
  note?: string | null;
  optimizePreset?: WebpOptimizeOptions;
  ownerProfileId: string;
  studentId?: string | null;
  title?: string;
  workspaceId: string;
}): Promise<{ evidenceId: string | null; result: StoredFileResult; tableReady: boolean }> {
  if (!isSupabaseReady || !supabase) {
    throw new Error('ระบบยังไม่ได้เชื่อมต่อ Supabase');
  }

  const safeName = params.file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const storagePath = `${params.workspaceId}/${params.moduleKey}/${params.studentId || 'shared'}/${crypto.randomUUID()}-${safeName}`;

  const result = await uploadWorkspaceFile({
    category: params.moduleKey,
    fallbackBucket: 'evidence-files',
    file: params.file,
    metadata: {
      entity_id: params.entityId || null,
      purpose: params.moduleKey,
      student_id: params.studentId || null,
    },
    optimizePreset: params.optimizePreset,
    ownerProfileId: params.ownerProfileId,
    privacyLevel: 'sensitive',
    storagePath,
    workspaceId: params.workspaceId,
  });

  const { data, error } = await supabase
    .from('student_evidence_files')
    .insert({
      created_by: params.ownerProfileId,
      entity_id: params.entityId || null,
      file_id: result.fileId,
      module_key: params.moduleKey,
      note: params.note || null,
      student_id: params.studentId || null,
      title: params.title?.trim() || params.file.name,
      workspace_id: params.workspaceId,
    })
    .select('id')
    .single();

  if (error) {
    if (isMissingColumnOrTableError(error)) {
      return { evidenceId: null, result, tableReady: false };
    }
    throw error;
  }

  return { evidenceId: data.id, result, tableReady: true };
}

export async function softDeleteStudentEvidence(workspaceId: string, evidenceId: string) {
  if (!isSupabaseReady || !supabase) return;
  const { error } = await supabase
    .from('student_evidence_files')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', evidenceId)
    .eq('workspace_id', workspaceId);
  if (error) throw error;
}
