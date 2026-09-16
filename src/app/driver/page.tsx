import Link from 'next/link';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { ChevronRight, Clock, History, MoveRight, Plus, Settings, Wallet } from 'lucide-react';
import { db } from '@/db';
import { trips } from '@/db/schema';
import { requireDriver } from '@/lib/auth';
import {
  formatDate,
  formatNaira,
  formatTime12,
  lagosToday,
  parsePeriod,
  periodRange,
  periodHeading,
  type Period,
} from '@/lib/time';
import { EmptyState } from '@/components/ui';
import { PeriodFilter } from '@/components/period-filter';
import { Pagination } from '@/components/pagination';

export const metadata = { title: 'Home' };

export default async function DriverHome({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string; page?: string }>;
}) {
  const session = await requireDriver();
  const today = lagosToday();
  const sp = await searchParams;

  // A custom From/To range (validated) wins over the period chip.
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const hasCustom = Boolean(
    sp.from && sp.to && DATE_RE.test(sp.from) && DATE_RE.test(sp.to) && sp.from <= sp.to,
  );
  const period: Period | 'custom' = hasCustom ? 'custom' : parsePeriod(sp.period);
  const [rangeFrom, rangeTo] = hasCustom
    ? [sp.from as string, sp.to as string]
    : periodRange(period as Period);

  const periodTrips = await db
    .select()
    .from(trips)
    .where(
      and(
        eq(trips.driverId, session.driverId),
        gte(trips.tripDate, rangeFrom),
        lte(trips.tripDate, rangeTo),
      ),
    )
    .orderBy(desc(trips.submittedAt));

  const active = periodTrips.filter((t) => !t.isVoided);
  const periodSeats = active.reduce((s, t) => s + t.seatsLoaded, 0);
  const periodMoney = active.reduce(
    (s, t) => s + t.tripAmountNgn * t.seatsLoaded + (t.cargoAmountNgn ?? 0),
    0,
  );

  // List pagination over the period's reports.
  const PAGE_SIZE = 15;
  const totalPages = Math.max(1, Math.ceil(periodTrips.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(sp.page) || 1), totalPages);
  const listTrips = periodTrips.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const pageExtra: Record<string, string | undefined> = hasCustom
    ? { from: sp.from, to: sp.to }
    : { period: sp.period || 'today' };

  return (
    <main>
      <header className="mb-5">
        <p className="text-sm font-semibold text-ink-500">{formatDate(today)}</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink-900">
          Hello, {session.name.split(' ')[0]}
        </h1>
      </header>

      {/* Primary action */}
      <div className="hero fade-up rounded-2xl p-5">
        <p className="text-sm font-medium text-brand-100">
          Just landed? File the trip you finished.
        </p>
        <Link href="/driver/new" className="btn btn-white btn-block btn-xl mt-4">
          <Plus size={20} strokeWidth={3} />
          File trip report
        </Link>
      </div>

      <div className="mt-5">
        <PeriodFilter basePath="/driver" current={period} />

      {/* Custom date range for the driver's own reports. */}
      <form method="get" className="card flex flex-wrap items-end gap-3 p-4">
        <label className="block">
          <span className="label">From date</span>
          <input type="date" name="from" defaultValue={rangeFrom} className="field" />
        </label>
        <label className="block">
          <span className="label">To date</span>
          <input type="date" name="to" defaultValue={rangeTo} className="field" />
        </label>
        <button type="submit" className="btn btn-dark">
          Apply dates
        </button>
        {hasCustom ? (
          <Link href="/driver" className="btn btn-ghost">
            Back to today
          </Link>
        ) : null}
      </form>
      </div>

      {/* Numbers for the selected period */}
      <div className="mt-3 grid grid-cols-3 gap-2.5">
        <div className="card-flat px-3 py-3 text-center">
          <div className="text-xl font-extrabold tabular-nums text-ink-900">{active.length}</div>
          <div className="mt-0.5 text-[11px] font-bold tracking-wide text-ink-500 uppercase">
            Trips
          </div>
        </div>
        <div className="card-flat px-3 py-3 text-center">
          <div className="text-xl font-extrabold tabular-nums text-ink-900">{periodSeats}</div>
          <div className="mt-0.5 text-[11px] font-bold tracking-wide text-ink-500 uppercase">
            Seats
          </div>
        </div>
        <div className="card-flat px-3 py-3 text-center">
          <div className="text-xl font-extrabold tabular-nums text-ink-900">
            {formatNaira(periodMoney)}
          </div>
          <div className="mt-0.5 text-[11px] font-bold tracking-wide text-ink-500 uppercase">
            Naira
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-xs font-semibold text-ink-400">
        {periodHeading(period, rangeFrom, rangeTo)}
      </p>

      <section className="mt-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-ink-900">
            {period === 'today' ? "Today's reports" : 'Reports in this period'}
          </h2>
          <Link
            href="/driver/history"
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800"
          >
            <History size={14} />
            All reports
          </Link>
        </div>

        {listTrips.length === 0 ? (
          <EmptyState>
            {period === 'today' ? 'No trips filed today yet.' : 'No trips in this period yet.'}
          </EmptyState>
        ) : (
          <ul className="space-y-2.5">
            {listTrips.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/driver/trips/${t.id}`}
                  className={`card flex items-center gap-3 px-4 py-3.5 ${
                    t.isVoided ? 'opacity-55' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div
                      className={`flex items-center gap-1.5 text-base font-bold text-ink-900 ${
                        t.isVoided ? 'line-through' : ''
                      }`}
                    >
                      <span className="truncate">{t.fromLocation}</span>
                      <MoveRight size={15} className="shrink-0 text-brand-600" />
                      <span className="truncate">{t.toLocation}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-500">
                      <span className="font-semibold">{t.seatsLoaded} seats</span>
                      <span className="inline-flex items-center gap-1">
                        <Wallet size={12} />
                        {formatNaira(t.tripAmountNgn * t.seatsLoaded)}
                        {t.hasCargo && t.cargoAmountNgn
                          ? ` + ${formatNaira(t.cargoAmountNgn)} cargo`
                          : ''}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock size={12} />
                        {formatTime12(t.arrivalTime)}
                      </span>
                    </div>
                    {t.isVoided ? (
                      <span className="chip chip-bad mt-2">Cancelled by admin</span>
                    ) : null}
                  </div>
                  <ChevronRight size={18} className="shrink-0 text-ink-300" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4">
          <Pagination
            basePath="/driver"
            page={page}
            totalPages={totalPages}
            totalItems={periodTrips.length}
            pageSize={PAGE_SIZE}
            extra={pageExtra}
          />
        </div>
      </section>

      <Link href="/driver/settings" className="btn btn-ghost btn-block mt-8">
        <Settings size={16} />
        Change my PIN
      </Link>
    </main>
  );
}
