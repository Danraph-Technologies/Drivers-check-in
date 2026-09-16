'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/** Sidebar / tab link that knows whether it is the current section. */
export function NavLink({
  href,
  label,
  icon,
  variant = 'side',
}: {
  href: string;
  label: string;
  icon: ReactNode;
  variant?: 'side' | 'tab';
}) {
  const pathname = usePathname();
  const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  const base = variant === 'side' ? 'side-link' : 'tab-link';
  const on = variant === 'side' ? 'side-link-active' : 'tab-link-active';

  return (
    <Link href={href} className={`${base} ${active ? on : ''}`}>
      {icon}
      {label}
    </Link>
  );
}