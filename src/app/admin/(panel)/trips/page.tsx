import Link from 'next/link';
import { and, desc, eq, gte, lte, ilike, or } from 'drizzle-orm';
import { Banknote, Package, Plus, Route, Search } from 'lucide-react';
import { db } from '@/db';
import { trips, drivers, users, buses } from '@/db/schema';
import { requireAdmin } from '@/lib/auth';
import {
  formatDate,
  formatNaira,
  formatTime12,
  parsePeriod,
  periodRange,
  periodHeading,
  type Period,
} from '@/lib/time';
import { EmptyState } from '@/components/ui';
import { PeriodFilter } from '@/components/period-filter';
import { TripModalRow } from '@/components/trip-modal';
import { Pagination } from '@/components/pagination';
import type { TripModalData } from '@/components/trip-modal';

export const metadata = { title: 'Trips' };

export default async function AdminTrips({
  searchParams,
}: {
  searchParams: Promise<{
    period?: string;
    from?: string;
    to?: string;
    driver?: string;
    q?: string;
    showVoided?: string;
    page?: string;
  }>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  // Custom range wins when both dates are given; otherwise the period chip.
  const hasCustom = Boolean(sp.from && sp.to);
  const period: Period | 'custom' = hasCustom ? 'custom' : parsePeriod(sp.period);
  const [fromDate, toDate] = hasCustom
    ? [sp.from as string, sp.to as string]
    : periodRange(period as Period);

  const conditions = [gte(trips.tripDate, fromDate), lte(trips.tripDate, toDate)];
  // Only filter when it is a real id; a tampered value must not 500 the page.
  if (sp.driver && /^[0-9a-f-]{36}$/i.test(sp.driver)) {
    conditions.push(eq(trips.driverId, sp.driver));
  }
  if (sp.showVoided !== '1') conditions.push(eq(trips.isVoided, false));
  if (sp.q) {
    const like = `%${sp.q}%`;
    const routeCond = or(ilike(trips.fromLocation, like), ilike(trips.toLocation, like));
    if (routeCond) conditions.push(routeCond);
  }

  // Both queries go out as ONE database round trip (neon-http batch).
  const [rows, driverList] = await db.batch([
    db
      .select({
        id: trips.id,
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
      .where(and(...conditions))
      .orderBy(desc(trips.tripDate), desc(trips.submittedAt))
      .limit(500),
    db
      .select({ id: drivers.id, name: users.name })
      .from(drivers)
      .innerJoin(users, eq(drivers.userId, users.id))
      .orderBy(users.name),
  ] as const);

  const active = rows.filter((r) => !r.isVoided);
  const totalSeats = active.reduce((s, r) => s + r.seats, 0);
  const totalTrip = active.reduce((s, r) => s + r.tripAmount * r.seats, 0);
  const totalCargo = active.reduce((s, r) => s + (r.cargoAmount ?? 0), 0);

  // Table pagination over the filtered rows.
  const PAGE_SIZE = 25;
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(sp.page) || 1), totalPages);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Page links keep every active filter so paging never resets the view.
  const pageExtra: Record<string, string | undefined> = {
    period: hasCustom ? undefined : sp.period || 'today',
    from: hasCustom ? sp.from : undefined,
    to: hasCustom ? sp.to : undefined,
    driver: sp.driver,
    q: sp.q,
    showVoided: sp.showVoided,
  };

  const toModal = (t: (typeof rows)[number]): TripModalData => ({
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

  // Keep the other filters when switching period chips.
  const chipExtra: Record<string, string | undefined> = {
    driver: sp.driver,
    q: sp.q,
    showVoided: sp.showVoided,
  };

  return (
    <main className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">Trips</h1>
          <p className="mt-1 text-sm text-ink-500">
            {period === 'custom'
              ? `${formatDate(fromDate)} to ${formatDate(toDate)}`
              : periodHeading(period, fromDate, toDate)}
          </p>
        </div>
        <Link href="/admin/trips/new" className="btn btn-primary btn-sm">
          <Plus size={15} strokeWidth={3} />
          File for a driver
        </Link>
      </header>

      <PeriodFilter
        basePath="/admin/trips"
        current={period}
        customFrom={fromDate}
        customTo={toDate}
        extra={chipExtra}
      />

      {/* Always-visible custom range; applying it overrides the chips.
          Driver, search and voided filters ride along. */}
      <form method="get" className="card flex flex-wrap items-end gap-3 p-4">
        {sp.driver ? <input type="hidden" name="driver" value={sp.driver} /> : null}
        {sp.q ? <input type="hidden" name="q" value={sp.q} /> : null}
        {sp.showVoided ? <input type="hidden" name="showVoided" value={sp.showVoided} /> : null}
        <label className="block">
          <span className="label">From date</span>
          <input type="date" name="from" defaultValue={fromDate} className="field" />
        </label>
        <label className="block">
          <span className="label">To date</span>
          <input type="date" name="to" defaultValue={toDate} className="field" />
        </label>
        <button type="submit" className="btn btn-dark">
          Apply dates
        </button>
        {hasCustom ? (
          <Link href="/admin/trips" className="btn btn-ghost">
            Clear range
          </Link>
        ) : null}
      </form>

      {/* Extra filters */}
      <form method="get" className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <input type="hidden" name="period" value={period} />
        {period === 'custom' ? (
          <>
            <input type="hidden" name="from" value={fromDate} />
            <input type="hidden" name="to" value={toDate} />
          </>
        ) : null}
        <label className="block">
          <span className="label">Driver</span>
          <select name="driver" defaultValue={sp.driver ?? ''} className="field">
            <option value="">All drivers</option>
            {driverList.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Route contains</span>
          <input
            type="text"
            name="q"
            defaultValue={sp.q ?? ''}
            placeholder="e.g. Nsukka"
            className="field"
          />
        </label>
        <div className="flex items-end gap-2">
          <label className="flex h-[2.6rem] flex-1 items-center gap-2 text-sm font-semibold text-ink-600">
            <input
              type="checkbox"
              name="showVoided"
              value="1"
              defaultChecked={sp.showVoided === '1'}
              className="h-4 w-4 rounded border-ink-300 accent-brand-600"
            />
            Show voided
          </label>
          <button type="submit" className="btn btn-dark btn-sm h-[2.6rem]">
            <Search size={14} />
            Apply
          </button>
        </div>
      </form>

      {/* Totals */}
      <div className="card-flat flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <span className="flex items-center gap-2 text-sm text-ink-500">
          <Route size={15} className="text-brand-600" />
          Trips
          <strong className="text-base font-extrabold tabular-nums text-ink-900">
            {active.length}
          </strong>
        </span>
        <span className="flex items-center gap-2 text-sm text-ink-500">
          <Banknote size={15} className="text-brand-600" />
          Trip total
          <strong className="text-base font-extrabold tabular-nums text-ink-900">
            {formatNaira(totalTrip)}
          </strong>
        </span>
        <span className="flex items-center gap-2 text-sm text-ink-500">
          <Package size={15} className="text-brand-600" />
          Cargo total
          <strong className="text-base font-extrabold tabular-nums text-ink-900">
            {formatNaira(totalCargo)}
          </strong>
        </span>
        <span className="ml-auto text-xs font-semibold text-ink-400">
          {totalSeats} seats &middot; {formatNaira(totalTrip + totalCargo)} NGN all in
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState>No trips match these filters.</EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Date</th>
                <th>Driver</th>
                <th>Bus</th>
                <th>Route</th>
                <th className="num">Seats</th>
                <th className="num">Trip (NGN)</th>
                <th className="num">Cargo (NGN)</th>
                <th>Arrival</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((t) => (
                <TripModalRow
                  key={t.id}
                  trip={toModal(t)}
                  className={t.isVoided ? 'voided-row' : ''}
                >
                  <td className="whitespace-nowrap font-semibold text-ink-900">
                    {formatDate(t.tripDate)}
                  </td>
                  <td className="font-semibold whitespace-nowrap">{t.driverName}</td>
                  <td className="whitespace-nowrap text-ink-600">{t.busLabel ?? '-'}</td>
                  <td className="whitespace-nowrap font-medium">
                    {t.from}
                    <span className="mx-1.5 text-ink-300">&rarr;</span>
                    {t.to}
                  </td>
                  <td className="num font-semibold">{t.seats}</td>
                  <td className="num font-semibold">{formatNaira(t.tripAmount * t.seats)}</td>
                  <td className="num text-ink-600">
                    {t.hasCargo ? formatNaira(t.cargoAmount ?? 0) : '-'}
                  </td>
                  <td className="whitespace-nowrap text-ink-500">{formatTime12(t.arrival)}</td>
                </TripModalRow>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>Totals (active trips)</td>
                <td className="num">{totalSeats}</td>
                <td className="num">{formatNaira(totalTrip)}</td>
                <td className="num">{formatNaira(totalCargo)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <Pagination
        basePath="/admin/trips"
        page={page}
        totalPages={totalPages}
        totalItems={rows.length}
        pageSize={PAGE_SIZE}
        extra={pageExtra}
      />
    </main>
  );
}
