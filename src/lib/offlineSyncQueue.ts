import type { SupabaseClient } from '@supabase/supabase-js';

export interface OfflineAttendanceRecordInput {
  checked_at: string;
  checked_by: string;
  note: string | null;
  status: string;
  student_id: string;
}

export interface OfflineAttendanceBatchPayload {
  attendanceDate: string;
  classroomId: string;
  createdBy: string;
  periodLabel: string;
  records: OfflineAttendanceRecordInput[];
  subjectName: string | null;
}

export interface OfflineScoreEntryInput {
  assessment_id: string;
  note: string | null;
  score: number | null;
  student_id: string;
  workspace_id: string;
}

export interface OfflineScoreEntriesPayload {
  entries: OfflineScoreEntryInput[];
}

export type OfflineQueueItem =
  | {
      createdAt: string;
      id: string;
      kind: 'attendance_batch';
      label: string;
      lastError?: string;
      payload: OfflineAttendanceBatchPayload;
      retryCount: number;
      workspaceId: string;
    }
  | {
      createdAt: string;
      id: string;
      kind: 'score_entries_batch';
      label: string;
      lastError?: string;
      payload: OfflineScoreEntriesPayload;
      retryCount: number;
      workspaceId: string;
    };

const OFFLINE_QUEUE_STORAGE_KEY = 'classcare:offline-queue:v1';
const OFFLINE_QUEUE_EVENT = 'classcare:offline-queue-changed';

export function isLikelyNetworkError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return true;
  }
  const msg =
    typeof err === 'string'
      ? err
      : err && typeof err === 'object' && 'message' in err
        ? String((err as { message?: unknown }).message || '')
        : '';
  return /failed to fetch|networkerror|network request failed|load failed|err_internet_disconnected|timeout|fetch failed|offline/i.test(
    msg,
  );
}

function readAllOfflineQueue(): OfflineQueueItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OfflineQueueItem[]) : [];
  } catch {
    return [];
  }
}

function writeAllOfflineQueue(items: OfflineQueueItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_EVENT));
  } catch {
    // Ignore storage quota / private mode failures
  }
}

export function getOfflineQueue(workspaceId?: string): OfflineQueueItem[] {
  const all = readAllOfflineQueue();
  if (!workspaceId) return all;
  return all.filter((item) => item.workspaceId === workspaceId);
}

export function enqueueOfflineMutation(
  item:
    | {
        kind: 'attendance_batch';
        label: string;
        payload: OfflineAttendanceBatchPayload;
        workspaceId: string;
      }
    | {
        kind: 'score_entries_batch';
        label: string;
        payload: OfflineScoreEntriesPayload;
        workspaceId: string;
      },
): OfflineQueueItem {
  const existing = readAllOfflineQueue();
  const created: OfflineQueueItem = {
    ...item,
    createdAt: new Date().toISOString(),
    id: `oq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    retryCount: 0,
  } as OfflineQueueItem;

  // Deduplicate identical attendance session or score entry sets cleanly so the latest state wins
  const filtered = existing.filter((cur) => {
    if (cur.workspaceId !== item.workspaceId || cur.kind !== item.kind) return true;
    if (cur.kind === 'attendance_batch' && item.kind === 'attendance_batch') {
      return !(
        cur.payload.classroomId === item.payload.classroomId &&
        cur.payload.attendanceDate === item.payload.attendanceDate &&
        cur.payload.periodLabel === item.payload.periodLabel
      );
    }
    if (cur.kind === 'score_entries_batch' && item.kind === 'score_entries_batch') {
      const incomingKeySet = new Set(item.payload.entries.map((e) => `${e.assessment_id}::${e.student_id}`));
      const existingAllCovered = cur.payload.entries.every((e) =>
        incomingKeySet.has(`${e.assessment_id}::${e.student_id}`),
      );
      return !existingAllCovered;
    }
    return true;
  });

  writeAllOfflineQueue([...filtered, created]);
  return created;
}

export function removeOfflineMutation(id: string): void {
  const existing = readAllOfflineQueue();
  writeAllOfflineQueue(existing.filter((item) => item.id !== id));
}

export function subscribeOfflineQueue(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (event: StorageEvent) => {
    if (!event.key || event.key === OFFLINE_QUEUE_STORAGE_KEY) {
      listener();
    }
  };
  const onCustom = () => listener();
  window.addEventListener(OFFLINE_QUEUE_EVENT, onCustom);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(OFFLINE_QUEUE_EVENT, onCustom);
    window.removeEventListener('storage', onStorage);
  };
}

let activeFlushPromise: Promise<{ synced: number; failed: number; remaining: number }> | null = null;

export async function flushOfflineQueue(
  client: SupabaseClient,
  workspaceId: string,
): Promise<{ synced: number; failed: number; remaining: number }> {
  if (activeFlushPromise) {
    return activeFlushPromise;
  }

  activeFlushPromise = (async () => {
    const queue = readAllOfflineQueue();
    const targets = queue.filter((item) => item.workspaceId === workspaceId);
    if (targets.length === 0) {
      return { synced: 0, failed: 0, remaining: 0 };
    }

    let synced = 0;
    let failed = 0;
    const completedIds = new Set<string>();
    const updatedErrors = new Map<string, string>();

    for (const item of targets) {
      try {
        if (item.kind === 'attendance_batch') {
          const { classroomId, attendanceDate, periodLabel, subjectName, createdBy, records } = item.payload;
          const { data: sessionRow, error: sessError } = await client
            .from('attendance_sessions')
            .upsert(
              {
                workspace_id: workspaceId,
                classroom_id: classroomId,
                attendance_date: attendanceDate,
                period_label: periodLabel,
                subject_name: subjectName,
                status: 'draft',
                created_by: createdBy,
              },
              { onConflict: 'workspace_id,classroom_id,attendance_date,period_label' },
            )
            .select('id')
            .single();

          if (sessError || !sessionRow?.id) {
            throw new Error(sessError?.message || 'Unable to resolve attendance session');
          }

          const recordRows = records.map((rec) => ({
            workspace_id: workspaceId,
            session_id: sessionRow.id,
            student_id: rec.student_id,
            status: rec.status,
            note: rec.note,
            checked_by: rec.checked_by,
            checked_at: rec.checked_at,
          }));

          const { error: recError } = await client
            .from('attendance_records')
            .upsert(recordRows, { onConflict: 'session_id,student_id' });

          if (recError) {
            throw new Error(recError.message);
          }

          completedIds.add(item.id);
          synced += 1;
        } else if (item.kind === 'score_entries_batch') {
          const scoreRows = item.payload.entries.map((entry) => ({
            workspace_id: workspaceId,
            assessment_id: entry.assessment_id,
            student_id: entry.student_id,
            score: entry.score,
            note: entry.note,
          }));

          if (scoreRows.length > 0) {
            const { error: scoreError } = await client
              .from('score_entries')
              .upsert(scoreRows, { onConflict: 'assessment_id,student_id' });
            if (scoreError) {
              throw new Error(scoreError.message);
            }
          }

          completedIds.add(item.id);
          synced += 1;
        }
      } catch (err) {
        failed += 1;
        updatedErrors.set(item.id, err instanceof Error ? err.message : 'Sync failed');
      }
    }

    const latestQueue = readAllOfflineQueue();
    const nextQueue = latestQueue
      .filter((item) => !completedIds.has(item.id))
      .map((item) =>
        updatedErrors.has(item.id)
          ? {
              ...item,
              retryCount: item.retryCount + 1,
              lastError: updatedErrors.get(item.id),
            }
          : item,
      );
    writeAllOfflineQueue(nextQueue);

    const remaining = nextQueue.filter((item) => item.workspaceId === workspaceId).length;
    return { synced, failed, remaining };
  })();

  try {
    return await activeFlushPromise;
  } finally {
    activeFlushPromise = null;
  }
}
