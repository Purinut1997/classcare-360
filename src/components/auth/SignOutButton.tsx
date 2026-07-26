import { LogOut } from 'lucide-react';

import { setStoredActiveWorkspaceId } from '../../lib/session';
import { supabase } from '../../lib/supabaseClient';

interface SignOutButtonProps {
  className?: string;
}

export function SignOutButton({ className = '' }: SignOutButtonProps) {
  async function handleSignOut() {
    setStoredActiveWorkspaceId(null);
    if (supabase) {
      await supabase.auth.signOut();
    }
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
