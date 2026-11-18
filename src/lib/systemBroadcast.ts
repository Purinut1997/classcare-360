import { supabase } from './supabaseClient';

export type BroadcastSeverity = 'info' | 'warning' | 'maintenance';

export interface SystemBroadcast {
  id: string;
  isActive: boolean;
  severity: BroadcastSeverity;
  title: string;
  message: string;
  linkText?: string;
  linkUrl?: string;
  createdAt: string;
  updatedAt: string;
  dismissible?: boolean;
  maintenanceLock?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
}

const BROADCAST_STORAGE_KEY = 'classcare_system_broadcast';
const BROADCAST_DISMISSED_KEY = 'classcare_broadcast_dismissed_id';

export function getSystemBroadcast(): SystemBroadcast | null {
  try {
    const raw = localStorage.getItem(BROADCAST_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SystemBroadcast;
    if (!parsed || !parsed.isActive) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSystemBroadcast(broadcast: SystemBroadcast): void {
  try {
    localStorage.setItem(BROADCAST_STORAGE_KEY, JSON.stringify(broadcast));
    window.dispatchEvent(new CustomEvent('classcare-broadcast-changed', { detail: broadcast }));
  } catch (err) {
    console.error('Failed to cache broadcast locally', err);
  }
}

export function clearSystemBroadcast(): void {
  try {
    localStorage.removeItem(BROADCAST_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('classcare-broadcast-changed', { detail: null }));
  } catch (err) {
    console.error('Failed to clear broadcast cache', err);
  }
}

export function isBroadcastDismissed(broadcastId: string): boolean {
  try {
    return localStorage.getItem(BROADCAST_DISMISSED_KEY) === broadcastId;
  } catch {
    return false;
  }
}

export function dismissBroadcast(broadcastId: string): void {
  try {
    localStorage.setItem(BROADCAST_DISMISSED_KEY, broadcastId);
    window.dispatchEvent(new CustomEvent('classcare-broadcast-changed'));
  } catch (err) {
    console.error('Failed to dismiss broadcast', err);
  }
}

export async function fetchActiveSystemBroadcast(): Promise<SystemBroadcast | null> {
  if (!supabase) return getSystemBroadcast();
  try {
    const { data, error } = await supabase.rpc('get_active_system_broadcast');
    if (error) {
      return getSystemBroadcast();
    }
    if (!data) {
      clearSystemBroadcast();
      return null;
    }
    const parsed = data as SystemBroadcast;
    if (parsed.isActive) {
      saveSystemBroadcast(parsed);
      return parsed;
    }
    clearSystemBroadcast();
    return null;
  } catch {
    return getSystemBroadcast();
  }
}

export async function saveSystemBroadcastToDb(
  broadcast: SystemBroadcast,
): Promise<{ data: SystemBroadcast | null; error: string | null; persistedToDb: boolean }> {
  if (!supabase) {
    saveSystemBroadcast(broadcast);
    return { data: broadcast, error: null, persistedToDb: false };
  }

  const { data, error } = await supabase.rpc('superadmin_upsert_system_broadcast', {
    p_is_active: broadcast.isActive,
    p_severity: broadcast.severity,
    p_title: broadcast.title,
    p_message: broadcast.message || '',
    p_link_text: broadcast.linkText || null,
    p_link_url: broadcast.linkUrl || null,
    p_dismissible: broadcast.dismissible !== false,
    p_maintenance_lock: Boolean(broadcast.maintenanceLock),
    p_starts_at: broadcast.startsAt || null,
    p_ends_at: broadcast.endsAt || null,
  });

  if (error) {
    return { data: null, error: error.message, persistedToDb: false };
  }

  const saved = (data as SystemBroadcast | null) || broadcast;
  if (saved.isActive) {
    saveSystemBroadcast(saved);
  } else {
    clearSystemBroadcast();
  }
  return { data: saved, error: null, persistedToDb: true };
}

export async function clearSystemBroadcastInDb(): Promise<{ error: string | null }> {
  clearSystemBroadcast();
  if (!supabase) return { error: null };

  const { error } = await supabase.rpc('superadmin_clear_system_broadcast');
  return { error: error ? error.message : null };
}
