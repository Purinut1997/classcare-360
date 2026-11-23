import { LogOut } from 'lucide-react';

import { setStoredActiveWorkspaceId } from '../../lib/session';
import { supabase } from '../../lib/supabaseClient';

interface SignOutButtonProps {
  className?: string;
}

function purgeSensitiveBrowserStorage() {
  try {
    if (typeof window === 'undefined') return;
    const clearMatchingKeys = (store: Storage) => {
      const keysToRemove: string[] = [];
      for (let i = 0; i < store.length; i += 1) {
        const key = store.key(i);
        if (
          key &&
          (key.startsWith('classcare') ||
            key.startsWith('cc360_') ||
            key.startsWith('omr_') ||
            key.includes('gemini'))
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => store.removeItem(key));
    };
    clearMatchingKeys(window.localStorage);
    clearMatchingKeys(window.sessionStorage);
  } catch {
    // Ignore storage access errors in restricted contexts
  }
}

export function SignOutButton({ className = '' }: SignOutButtonProps) {
  async function handleSignOut() {
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      setStoredActiveWorkspaceId(null, user?.id);
      await supabase.auth.signOut();
    } else {
      setStoredActiveWorkspaceId(null);
    }
    purgeSensitiveBrowserStorage();
    window.location.assign('/login');
  }

  return (
    <button
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 transition hover:border-slate-300 hover:text-slate-950 ${className}`}
      onClick={handleSignOut}
      type="button"
    >
      <LogOut size={17} aria-hidden="true" />
      <span>ออกจากระบบ</span>
    </button>
  );
}
