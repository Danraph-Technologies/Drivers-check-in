import Link from 'next/link';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import {
  Banknote,
  BusFront,
  ChevronRight,
  Fuel,
  Package,
  Phone,
  Route,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import { db } from '@/db';
import { trips, drivers, users, buses } from '@/db/schema';
import { requireAdmin } from '@/lib/auth';
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
import { EmptyState, StatTile } from '@/components/ui';
import { PeriodFilter } from '@/components/period-filter';
import { TripModalRow } from '@/components/trip-modal';
import { Pagination } from '@/components/pagination';
import type { TripModalData } from '@/components/trip-modal';

export const metadata = { title: 'Dashboard' };

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string; page?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const today = lagosToday();

  // A custom range (from + to) wins; otherwise the period chip decides.
  const hasCustom = Boolean(sp.from && sp.to);
  const period: Period | 'custom' = hasCustom ? 'custom' : parsePeriod(sp.period);
  const [rangeFrom, rangeTo] = hasCustom
    ? [sp.from as string, sp.to as string]
    : periodRange(period as Period);

  // Page links carry the current filter so paging does not reset it.
  const pageExtra: Record<string, string | undefined> = {
    period: hasCustom ? undefined : sp.period || 'today',
    from: hasCustom ? sp.from : undefined,
    to: hasCustom ? sp.to : undefined,
  };

  // Both queries go out as ONE database round trip (neon-http batch).
  const [periodTrips, allActiveDrivers] = await db.batch([
    db
      .select({
        id: trips.id,
        driverId: trips.driverId,
        tripDate: trips.tripDate,
        from: trips.fromLocation,
        to: trips.toLocation,
        seats: trips.seatsLoaded,
        tripAmount: trips.tripAmountNgn,
        hasCargo: trips.hasCargo,
        cargoAmount: trips.cargoAmountNgn,
        fuelAmount: trips.fuelAmountNgn,
        feedingAmount: trips.feedingAmountNgn,
        isVoided: trips.isVoided,
        voidReason: trips.voidReason,
        arrival: trips.arrivalTime,
        lat: trips.lat,
        lng: trips.lng,
        accuracyM: trips.accuracyM,
        locationAddress: trips.locationAddress,
        locationStatus: trips.locationStatus,
        submittedAt: trips.submittedAt,
        driverName: users.name,
        busLabel: buses.label,
      })
      .from(trips)
      .innerJoin(drivers, eq(trips.driverId, drivers.id))
      .innerJoin(users, eq(drivers.userId, users.id))
      .leftJoin(buses, eq(trips.busId, buses.id))
      .where(and(gte(trips.tripDate, rangeFrom), lte(trips.tripDate, rangeTo)))
      .orderBy(desc(trips.submittedAt)),
    db
      .select({
        id: drivers.id,
        name: users.name,
        phone: drivers.phone,
        busLabel: buses.label,
        reportedToday: sql<boolean>`EXISTS (
          SELECT 1 FROM ${trips}
          WHERE ${trips.driverId} = ${drivers.id}
            AND ${trips.tripDate} = ${today}
            AND ${trips.isVoided} = false
        )`,
      })
      .from(drivers)
      .innerJoin(users, eq(drivers.userId, users.id))
      .leftJoin(buses, eq(drivers.assignedBusId, buses.id))
      .where(and(eq(drivers.status, 'active'), eq(users.isActive, true)))
      .orderBy(users.name),
  ] as const);

  // Table pagination: tiles and totals use the whole range, the table
  // shows one page at a time.
  const PAGE_SIZE = 25;
  const totalPages = Math.max(1, Math.ceil(periodTrips.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(sp.page) || 1), totalPages);
  const pageTrips = periodTrips.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const active = periodTrips.filter((t) => !t.isVoided);
  const seats = active.reduce((sum, t) => sum + t.seats, 0);
  const seatsTotal = active.reduce((sum, t) => sum + t.tripAmount * t.seats, 0);
  const cargoRevenue = active.reduce((sum, t) => sum + (t.cargoAmount ?? 0), 0);
  const fuelTotal = active.reduce((sum, t) => sum + t.fuelAmount, 0);
  const feedingTotal = active.reduce((sum, t) => sum + t.feedingAmount, 0);
  // Cargo goes to the driver, so it is company money out of the net.
  const netProfit = seatsTotal - fuelTotal - feedingTotal;

  // The call list is a today concept: who has not reported today.
  const activeDriverCount = allActiveDrivers.length;
  const loadedCount = new Set(
    active.filter((t) => t.tripDate === today).map((t) => t.driverId),
  ).size;
  const notReportedList = allActiveDrivers.filter((d) => !d.reportedToday);

  const pct = activeDriverCount > 0 ? Math.round((loadedCount / activeDriverCount) * 100) : 0;

  const toModal = (t: (typeof periodTrips)[number]): TripModalData => ({
    id: t.id,
    driverName: t.driverName,
    busLabel: t.busLabel,
    tripDate: t.tripDate,
    fromLocation: t.from,
    toLocation: t.to,
    seatsLoaded: t.seats,
    tripAmountNgn: t.tripAmount,
    hasCargo: t.hasCargo,
    cargoAmountNgn: t.cargoAmount,
    fuelAmountNgn: t.fuelAmount,
    feedingAmountNgn: t.feedingAmount,
    arrivalTime: t.arrival,
    submittedAt: t.submittedAt,
    locationStatus: t.locationStatus,
    lat: t.lat,
    lng: t.lng,
    accuracyM: t.accuracyM,
    locationAddress: t.locationAddress,
    isVoided: t.isVoided,
    voidReason: t.voidReason,
  });

  return (
    <main className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">Dashboard</h1>
          <p className="mt-1 text-sm text-ink-500">
            {period === 'custom'
              ? `${formatDate(rangeFrom)} to ${formatDate(rangeTo)}`
              : periodHeading(period, rangeFrom, rangeTo)}{' '}
            &middot; WAT
          </p>
        </div>
        <Link href="/admin/trips/new" className="btn btn-outline btn-sm">
          File for a driver
        </Link>
      </header>

      <PeriodFilter basePath="/admin" current={period} />

      {/* Always-visible custom range; applying it overrides the chips. */}
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
          <a href="/admin" className="btn btn-ghost">
            Back to today
          </a>
        ) : null}
      </form>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-7">
        <StatTile
          label="Trips"
          value={String(active.length)}
          icon={<Route size={16} />}
        />
        <StatTile label="Seats" value={String(seats)} icon={<Users size={16} />} />
        <StatTile
          label="Trip earnings"
          value={formatNaira(seatsTotal)}
          icon={<Banknote size={16} />}
        />
        <StatTile
          label="Cargo earnings"
          value={formatNaira(cargoRevenue)}
          icon={<Package size={16} />}
        />
        <StatTile
          label="Road expenses"
          value={formatNaira(fuelTotal + feedingTotal)}
          hint={`Fuel ${formatNaira(fuelTotal)} · Feeding ${formatNaira(feedingTotal)}`}
          icon={<Fuel size={16} />}
        />
        <StatTile
          label="Net profit"
          value={formatNaira(netProfit)}
          hint="Trip earnings minus road expenses. Since cargo goes to the driver, not the company."
          tone="brand"
          icon={<TrendingDown size={16} />}
        />
        <StatTile
          label="Drivers loaded"
          value={`${loadedCount} of ${activeDriverCount}`}
          hint={`${pct}% reported today`}
          tone="brand"
          icon={<UserCheck size={16} />}
        />
      </div>

      {/* Call list */}
      <section className="card p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-bold text-ink-900">
            <Phone size={16} className="text-amber-600" />
            Not reported today
            <span className="chip chip-warn">{notReportedList.length}</span>
          </h2>
          <span className="text-xs font-semibold text-ink-400">Your call list</span>
        </div>

        {notReportedList.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">
            <UserCheck size={17} />
            Every active driver has reported today.
          </div>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {notReportedList.map((d) => (
              <li key={d.id} className="chip chip-warn">
                <span className="font-bold">{d.name}</span>
                {d.busLabel ? (
                  <span className="text-amber-700/80">&middot; {d.busLabel}</span>
                ) : null}
                <a
                  href={`tel:${d.phone}`}
                  className="ml-1 inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-bold text-amber-900"
                >
                  <Phone size={11} />
                  {d.phone}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Trips in the selected period */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-ink-900">
            {period === 'custom' ? 'Trips in this range' : 'Trips'}
          </h2>
          <Link
            href="/admin/trips"
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800"
          >
            All trips
            <ChevronRight size={14} />
          </Link>
        </div>

        {periodTrips.length === 0 ? (
          <EmptyState>No trips in this period yet.</EmptyState>
        ) : (
          <div className="card overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Driver</th>
                  <th>Bus</th>
                  <th>Route</th>
                  <th className="num">Seats</th>
                  <th className="num">Trip (NGN)</th>
                  <th className="num">Cargo (NGN)</th>
                  <th>Arrival</th>
                  <th>Filed</th>
                </tr>
              </thead>
              <tbody>
                {pageTrips.map((t) => (
                  <TripModalRow
                    key={t.id}
                    trip={toModal(t)}
                    className={t.isVoided ? 'voided-row' : ''}
                  >
                    <td className="font-semibold whitespace-nowrap">{t.driverName}</td>
                    <td className="whitespace-nowrap text-ink-600">
                      {t.busLabel ? (
                        <span className="chip chip-info">
                          <BusFront size={11} />
                          {t.busLabel}
                        </span>
                      ) : (
                        <span className="text-ink-400">-</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap font-medium">
                      {t.from}
                      <span className="mx-1.5 text-ink-300">&rarr;</span>
                      {t.to}
                    </td>
                    <td className="num font-semibold">{t.seats}</td>
                    <td className="num font-semibold">
                      {formatNaira(t.tripAmount * t.seats)}
                    </td>
                    <td className="num text-ink-600">
                      {t.hasCargo ? formatNaira(t.cargoAmount ?? 0) : '-'}
                    </td>
                    <td className="whitespace-nowrap text-ink-500">
                      {formatTime12(t.arrival)}
                    </td>
                    <td className="whitespace-nowrap text-ink-500">
                      {formatTime12(
                        new Intl.DateTimeFormat('en-GB', {
                          timeZone: 'Africa/Lagos',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                        }).format(t.submittedAt),
                      )}
                    </td>
                  </TripModalRow>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>
                    <span className="inline-flex items-center gap-1.5">
                      <TrendingUp size={14} className="text-brand-600" />
                      Totals
                    </span>
                  </td>
                  <td className="num">{seats}</td>
                  <td className="num">{formatNaira(seatsTotal)}</td>
                  <td className="num">{formatNaira(cargoRevenue)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <Pagination
          basePath="/admin"
          page={page}
          totalPages={totalPages}
          totalItems={periodTrips.length}
          pageSize={PAGE_SIZE}
          extra={pageExtra}
        />
      </section>
    </main>
  );
}
