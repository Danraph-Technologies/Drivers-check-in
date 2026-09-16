import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  BusFront,
  ChartColumn,
  LayoutDashboard,
  LogOut,
  Route,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { getSession } from '@/lib/auth';
import { logout } from '@/app/actions/auth';
import { NavLink } from './NavLink';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    redirect('/admin/login');
  }

  // Re-check the account on every navigation so a removed or deactivated
  // admin cannot keep using an old cookie.
  const adminRows = await db
    .select({ isActive: users.isActive })
    .from(users)
    .where(eq(users.id, session.sub));
  const account = adminRows[0];
  if (!account) {
    redirect('/logout?error=' + encodeURIComponent('Your session has expired. Please sign in again.'));
  }
  if (!account.isActive) {
    redirect('/logout?error=' + encodeURIComponent('This account is not active. Contact the admin'));
  }

  const nav = [
    { label: 'Dashboard', href: '/admin', icon: <LayoutDashboard size={17} /> },
    { label: 'Trips', href: '/admin/trips', icon: <Route size={17} /> },
    { label: 'Drivers', href: '/admin/drivers', icon: <Users size={17} /> },
    { label: 'Buses', href: '/admin/buses', icon: <BusFront size={17} /> },
    { label: 'Reports', href: '/admin/reports', icon: <ChartColumn size={17} /> },
    { label: 'Team', href: '/admin/team', icon: <ShieldCheck size={17} /> },
  ];

  const initials = session.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1500px] flex-col lg:flex-row lg:gap-6 lg:p-5">
      {/* Desktop sidebar */}
      <aside className="panel-dark hidden w-64 shrink-0 flex-col rounded-3xl p-4 lg:flex">
        <Link href="/admin" className="flex items-center px-2 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-white.png"
            alt="DanRaph Integrated Services"
            width={531}
            height={141}
            className="h-8 w-auto"
          />
          <span className="ml-3 border-l border-white/15 pl-3 text-[11px] font-bold tracking-wide text-white/70 uppercase">
            Management
          </span>
        </Link>

        <nav className="mt-6 flex flex-1 flex-col gap-1">
          {nav.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} />
          ))}
        </nav>

        <div className="mt-4 border-t border-white/10 pt-4">
          <div className="flex items-center gap-2.5 px-2 pb-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-bold text-white">
              {initials || 'A'}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-white">{session.name}</span>
              <span className="block text-[11px] text-ink-400">Administrator</span>
            </span>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="side-link w-full"
            >
              <LogOut size={17} />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile header + tabs */}
      <div className="lg:hidden">
        <div className="panel-dark rounded-b-3xl px-4 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <Link href="/admin" className="flex items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-white.png"
                alt="DanRaph Integrated Services"
                width={531}
                height={141}
                className="h-7 w-auto"
              />
              <span className="ml-2.5 border-l border-white/15 pl-2.5 text-[11px] font-bold tracking-wide text-white/70 uppercase">
                Admin
              </span>
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-ink-200"
              >
                Sign out
              </button>
            </form>
          </div>
          <nav className="mt-3 -mb-1 flex gap-1.5 overflow-x-auto pb-1">
            {nav.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                variant="tab"
              />
            ))}
          </nav>
        </div>
      </div>

      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-0 lg:py-2">{children}</main>
    </div>
  );
}