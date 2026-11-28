export interface LocalDraft<T> { version: 1; updatedAt: number; value: T }
export function readLocalDraft<T extends object>(storage: Pick<Storage, 'getItem' | 'removeItem'>, key: string, now = Date.now()): LocalDraft<T> | null {
  const raw = storage.getItem(key);
  if (!raw) return null;
  let draft: LocalDraft<T>;
  try { draft = JSON.parse(raw) as LocalDraft<T>; } catch { storage.removeItem(key); return null; }
  if (draft?.version !== 1 || !draft.value || typeof draft.value !== 'object' || !Number.isFinite(draft.updatedAt) || now < draft.updatedAt || now - draft.updatedAt >= 7 * 86400000) { storage.removeItem(key); return null; }
  return draft;
}
