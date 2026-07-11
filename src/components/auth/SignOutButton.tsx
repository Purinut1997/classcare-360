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
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/95 px-4 text-sm font-black text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:text-slate-950 hover:shadow-md ${className}`}
      onClick={handleSignOut}
      type="button"
    >
      <LogOut size={17} aria-hidden="true" />
      ออกจากระบบ
    </button>
  );
}
