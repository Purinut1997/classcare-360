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
    // Dispatch event so active tabs pick it up immediately
    window.dispatchEvent(new CustomEvent('classcare-broadcast-changed', { detail: broadcast }));
  } catch (err) {
    console.error('Failed to save broadcast', err);
  }
}

export function clearSystemBroadcast(): void {
  try {
    localStorage.removeItem(BROADCAST_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('classcare-broadcast-changed', { detail: null }));
  } catch (err) {
    console.error('Failed to clear broadcast', err);
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
