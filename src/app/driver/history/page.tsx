import Link from 'next/link';
import { desc, eq, sql } from 'drizzle-orm';
import { ChevronRight, MapPin, Package, Wallet } from 'lucide-react';
import { db } from '@/db';
import { trips } from '@/db/schema';
import { requireDriver } from '@/lib/auth';
import { formatDate, formatNaira, formatTime12 } from '@/lib/time';
import { EmptyState } from '@/components/ui';
import { Pagination } from '@/components/pagination';

export const metadata = { title: 'My reports' };

export default async function DriverHistory({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await requireDriver();
  const sp = await searchParams;

  const PAGE_SIZE = 15;
  const rawPage = Math.max(1, Number(sp.page) || 1);

  // Count + one page of rows in a single database round trip (neon-http).
  const [[{ total }], rows] = await db.batch([
    db
      .select({
        total: sql<number>`count(*)::int`,
      })
      .from(trips)
      .where(eq(trips.driverId, session.driverId)),
    db
      .select()
      .from(trips)
      .where(eq(trips.driverId, session.driverId))
      .orderBy(desc(trips.tripDate), desc(trips.submittedAt))
      .limit(PAGE_SIZE)
      .offset((rawPage - 1) * PAGE_SIZE),
  ] as const);

  // Clamp the requested page against the real total.
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(rawPage, totalPages);

  // Group by trip date for a scannable list.
  const groups = new Map<string, typeof rows>();
  for (const t of rows) {
    const list = groups.get(t.tripDate) ?? [];
    list.push(t);
    groups.set(t.tripDate, list);
  }

  return (
    <main>
      <header className="mb-6">
        <Link
          href="/driver"
          className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-ink-500 hover:text-ink-800"
        >
          <ChevronRight size={14} className="rotate-180" />
          Home
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">My reports</h1>
        <p className="mt-1 text-sm text-ink-500">
          {total} report{total === 1 ? '' : 's'} on record
        </p>
      </header>

      {total === 0 ? (
        <EmptyState>You have not filed any reports yet.</EmptyState>
      ) : (
        <div className="space-y-6">
          {[...groups.entries()].map(([date, list]) => (
            <section key={date}>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-xs font-bold tracking-wide text-ink-500 uppercase">
                  {formatDate(date)}
                </h2>
                <span className="h-px flex-1 bg-ink-200" />
                <span className="text-xs font-semibold text-ink-400">
                  {list.length} trip{list.length === 1 ? '' : 's'}
                </span>
              </div>
              <ul className="space-y-2">
                {list.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/driver/trips/${t.id}`}
                      className={`card flex items-center gap-3 px-4 py-3 ${
                        t.isVoided ? 'opacity-55' : ''
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div
                          className={`text-base font-bold text-ink-900 ${
                            t.isVoided ? 'line-through' : ''
                          }`}
                        >
                          {t.fromLocation} to {t.toLocation}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-500">
                          <span className="font-semibold">{t.seatsLoaded} seats</span>
                          <span className="inline-flex items-center gap-1">
                            <Wallet size={12} />
                            {formatNaira(t.tripAmountNgn * t.seatsLoaded)}
                          </span>
                          {t.hasCargo && t.cargoAmountNgn ? (
                            <span className="inline-flex items-center gap-1">
                              <Package size={12} />
                              {formatNaira(t.cargoAmountNgn)}
                            </span>
                          ) : null}
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={12} />
                            {formatTime12(t.arrivalTime)}
                          </span>
                        </div>
                        {t.isVoided ? (
                          <span className="chip chip-bad mt-2">Cancelled by admin</span>
                        ) : null}
                      </div>
                      <ChevronRight size={17} className="shrink-0 text-ink-300" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      <div className="mt-5">
        <Pagination
          basePath="/driver/history"
          page={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={PAGE_SIZE}
        />
      </div>
    </main>
  );
}