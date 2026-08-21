import type { ComponentProps } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { withDemoContext } from '../../lib/auth';

type LinkProps = ComponentProps<typeof Link>;

/**
 * Keeps the active development demo role/workspace while navigating inside the app.
 * Real authenticated sessions are unaffected because they do not have a demo query.
 */
export function ContextLink({ to, ...props }: LinkProps) {
  const { search } = useLocation();
  const contextualTo = typeof to === 'string' && to.startsWith('/') ? withDemoContext(to, search) : to;

  return <Link {...props} to={contextualTo} />;
}
