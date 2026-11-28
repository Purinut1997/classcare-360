import { useEffect, useRef, useState } from 'react';
import { readLocalDraft, type LocalDraft } from '../lib/localDraftStorage';


/** Device-local drafts never submit a form or repeat a financial transaction. */
export function useLocalDraft<T extends object>(key: string, value: T, restore: (value: T) => void, enabled = true) {
  const [pending, setPending] = useState<LocalDraft<T> | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const [changed, setChanged] = useState(0);
  const dirty = useRef({ key, value: false });
  const latest = useRef(value);
  latest.current = value;
  const serialized = JSON.stringify(value);
  const baseline = useRef(serialized);

  useEffect(() => {
    dirty.current = { key, value: false };
    baseline.current = JSON.stringify(latest.current);
    setSavedAt(null); setPending(null); setError(false);
    if (!enabled) return;
    try {
      setPending(readLocalDraft<T>(localStorage, key));
    } catch { setError(true); }
  }, [key, enabled]);

  useEffect(() => {
    if (!enabled || pending || dirty.current.key !== key || !dirty.current.value || serialized === baseline.current) return;
    const persist = (silent = false) => {
      if (dirty.current.key !== key || !dirty.current.value || serialized === baseline.current) return;
      try {
        const updatedAt = Date.now();
        localStorage.setItem(key, JSON.stringify({ version: 1, updatedAt, value: JSON.parse(serialized) }));
        baseline.current = serialized;
        if (!silent) { setSavedAt(updatedAt); setError(false); }
      } catch { if (!silent) setError(true); }
    };
    const saveOnLeave = () => persist(true);
    const timer = window.setTimeout(() => persist(), 400);
    window.addEventListener('pagehide', saveOnLeave);
    return () => { clearTimeout(timer); saveOnLeave(); window.removeEventListener('pagehide', saveOnLeave); };
  }, [key, enabled, serialized, changed, pending]);

  function clear() {
    dirty.current = { key, value: false };
    baseline.current = JSON.stringify(latest.current);
    try { localStorage.removeItem(key); setError(false); } catch { setError(true); }
    setPending(null); setSavedAt(null);
  }
  return {
    pending, savedAt, error,
    markChanged: () => { dirty.current = { key, value: true }; setChanged((n) => n + 1); },
    clear,
    recover: () => { if (pending) { restore(pending.value); setSavedAt(pending.updatedAt); setPending(null); dirty.current = { key, value: true }; } },
  };
}
