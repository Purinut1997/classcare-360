import type { ComponentProps, MouseEventHandler, ReactNode } from 'react';
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

interface AppNavigationLinkProps {
  children: ReactNode;
  className?: string;
  externalUrl?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  title?: string;
  to: string;
}

export function AppNavigationLink({ children, className, externalUrl, onClick, title, to }: AppNavigationLinkProps) {
  if (externalUrl) {
    return (
      <a className={className} href={externalUrl} onClick={onClick} rel="noopener noreferrer" target="_blank" title={title}>
        {children}
      </a>
    );
  }

  return <ContextLink className={className} onClick={onClick} title={title} to={to}>{children}</ContextLink>;
}
