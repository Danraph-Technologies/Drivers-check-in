import Link from 'next/link';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { drivers, users } from '@/db/schema';
import { getSession } from '@/lib/auth';
import { logout } from '@/app/actions/auth';

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== 'driver' || !session.driverId) {
    redirect('/login');
  }

  // Re-check active status on every navigation so deactivation kills stale sessions.
  const rows = await db
    .select({ isActive: users.isActive, status: drivers.status })
    .from(drivers)
    .innerJoin(users, eq(drivers.userId, users.id))
    .where(eq(drivers.id, session.driverId));
  const d = rows[0];
  if (!d || !d.isActive || d.status !== 'active') {
    redirect('/login?error=This+account+is+not+active.+Contact+the+admin');
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md px-5 pb-10 pt-5">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/driver" className="inline-flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="DanRaph Integrated Services"
            width={531}
            height={141}
            className="h-7 w-auto"
          />
        </Link>
        {session.busLabel ? (
          <span className="chip chip-info">{session.busLabel}</span>
        ) : null}
      </div>

      {children}

      <form action={logout} className="mt-10 hairline pt-5">
        <button type="submit" className="btn btn-ghost btn-block">
          Sign out
        </button>
      </form>
    </div>
  );
}