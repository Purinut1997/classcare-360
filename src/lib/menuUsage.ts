import type { AppNavItem } from '../routes/appRoutes';
import type { AppSessionContext } from '../types/core';
import { supabase } from './supabaseClient';

export function menuUsageConsentKey(session: AppSessionContext) {
  return `classcare_menu_usage_consent:${session.workspace?.id || 'no-workspace'}:${session.profile.id}`;
}

export function recordMenuUsageFromNavigation(
  event: MouseEvent,
  session: AppSessionContext | undefined,
  navItems: AppNavItem[],
) {
  if (!session?.workspace || !supabase) return;

  try {
    if (window.localStorage.getItem(menuUsageConsentKey(session)) !== 'true') return;
  } catch {
    return;
  }

  const target = event.target;
  if (!(target instanceof Element)) return;
  const anchor = target.closest<HTMLAnchorElement>('a[href]');
  if (!anchor) return;

  let menuKey = '';
  try {
    const url = new URL(anchor.href, window.location.origin);
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/app/')) return;
    menuKey = url.searchParams.get('view') || (url.pathname === '/app/dashboard' ? 'overview' : '');
  } catch {
    return;
  }

  if (!menuKey || !navItems.some((item) => item.key === menuKey)) return;
  void supabase.rpc('record_workspace_menu_usage', {
    target_menu_key: menuKey,
    target_workspace_id: session.workspace.id,
  }).then(({ error }) => {
    if (error) console.warn('menu usage could not be recorded', error.message);
  });
}
