import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { Banknote, Download, FileText, Fuel, Package, Route, Users } from 'lucide-react';
import { db } from '@/db';
import { trips, drivers, users, buses } from '@/db/schema';
import { requireAdmin } from '@/lib/auth';
import { formatDate, formatNaira, currentWeekRange, mondayOf } from '@/lib/time';
import { addDays, daysInclusive } from '@/lib/time';
import { EmptyState, StatTile } from '@/components/ui';
import { Pagination } from '@/components/pagination';

export const metadata = { title: 'Activity report' };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function AdminReports({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; from?: string; to?: string; page?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  // A valid custom From/To range wins over the week picker; anything
  // tampered falls back to the current week.
  const validCustom =
    sp.from && sp.to && DATE_RE.test(sp.from) && DATE_RE.test(sp.to) && sp.from <= sp.to;
  const isCustom = Boolean(validCustom);
  const [rangeFrom, rangeTo] = isCustom
    ? [sp.from as string, sp.to as string]
    : sp.week
      ? [mondayOf(sp.week), addDays(mondayOf(sp.week), 6)]
      : currentWeekRange();

  // Both queries go out as ONE database round trip (neon-http batch).
  const [rows, daily] = await db.batch([
    db
      .select({
        driverId: trips.driverId,
        driverName: users.name,
        busLabel: buses.label,
        tripCount: sql<number>`count(*)::int`,
        seats: sql<number>`coalesce(sum(${trips.seatsLoaded}), 0)::int`,
        tripAmount: sql<number>`coalesce(sum(${trips.tripAmountNgn} * ${trips.seatsLoaded}), 0)::int`,
        cargoAmount: sql<number>`coalesce(sum(${trips.cargoAmountNgn}), 0)::int`,
        fuelAmount: sql<number>`coalesce(sum(${trips.fuelAmountNgn}), 0)::int`,
        feedingAmount: sql<number>`coalesce(sum(${trips.feedingAmountNgn}), 0)::int`,
      })
      .from(trips)
      .innerJoin(drivers, eq(trips.driverId, drivers.id))
      .innerJoin(users, eq(drivers.userId, users.id))
      .leftJoin(buses, eq(trips.busId, buses.id))
      .where(
        and(
          eq(trips.isVoided, false),
          gte(trips.tripDate, rangeFrom),
          lte(trips.tripDate, rangeTo),
        ),
      )
      .groupBy(trips.driverId, users.name, buses.label)
      .orderBy(users.name),
    // Daily revenue for the bar chart, Monday to Sunday.
    db
      .select({
        tripDate: trips.tripDate,
        revenue: sql<number>`coalesce(sum((${trips.tripAmountNgn} * ${trips.seatsLoaded}) + coalesce(${trips.cargoAmountNgn}, 0)), 0)::int`,
      })
      .from(trips)
      .where(
        and(
          eq(trips.isVoided, false),
          gte(trips.tripDate, rangeFrom),
          lte(trips.tripDate, rangeTo),
        ),
      )
      .groupBy(trips.tripDate),
  ] as const);

  const revenueByDate = new Map(daily.map((d) => [d.tripDate, d.revenue]));
  // Bars for the actual range; a very long range (over 31 days) skips
  // the daily chart instead of drawing hundreds of thin bars.
  const dayCount = daysInclusive(rangeFrom, rangeTo);
  const showDaily = dayCount <= 31;
  const days = showDaily
    ? Array.from({ length: dayCount }, (_, i) => addDays(rangeFrom, i))
    : [];
  const maxRevenue = Math.max(1, ...days.map((d) => revenueByDate.get(d) ?? 0));

  // Per-driver table pagination (totals stay over the whole range).
  const PAGE_SIZE = 25;
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(sp.page) || 1), totalPages);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const rangeExtra: Record<string, string | undefined> = isCustom
    ? { from: rangeFrom, to: rangeTo }
    : sp.week
      ? { week: sp.week }
      : {};

  const totalTrips = rows.reduce((s, r) => s + r.tripCount, 0);
  const totalSeats = rows.reduce((s, r) => s + r.seats, 0);
  const totalTrip = rows.reduce((s, r) => s + r.tripAmount, 0);
  const totalCargo = rows.reduce((s, r) => s + r.cargoAmount, 0);
  const totalFuel = rows.reduce((s, r) => s + r.fuelAmount, 0);
  const totalFeeding = rows.reduce((s, r) => s + r.feedingAmount, 0);

  return (
    <main className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">Activity report</h1>
          <p className="mt-1 text-sm text-ink-500">
            {formatDate(rangeFrom)} to {formatDate(rangeTo)}
            {isCustom ? ' (custom range)' : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form method="get" className="flex items-center gap-2">
            <input
              type="date"
              name="from"
              defaultValue={rangeFrom}
              aria-label="From date"
              className="field !w-auto"
            />
            <span className="text-xs font-semibold text-ink-400">to</span>
            <input
              type="date"
              name="to"
              defaultValue={rangeTo}
              aria-label="To date"
              className="field !w-auto"
            />
            <button type="submit" className="btn btn-dark btn-sm">
              Apply
            </button>
          </form>
          {isCustom ? (
            <a href="/admin/reports" className="btn btn-ghost btn-sm">
              Back to this week
            </a>
          ) : (
            <form method="get" className="flex items-center gap-2">
              <input
                type="date"
                name="week"
                defaultValue={rangeFrom}
                aria-label="Pick a week"
                className="field !w-auto"
              />
              <button type="submit" className="btn btn-outline btn-sm">
                Go
              </button>
            </form>
          )}
          <a
            href={`/admin/reports/export?from=${rangeFrom}&to=${rangeTo}`}
            className="btn btn-outline btn-sm"
          >
            <Download size={14} />
            Export CSV
          </a>
          <a
            href={`/admin/reports/export-pdf?from=${rangeFrom}&to=${rangeTo}`}
            className="btn btn-dark btn-sm"
            target="_blank"
            rel="noreferrer"
          >
            <FileText size={14} />
            Download PDF
          </a>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Trips" value={String(totalTrips)} icon={<Route size={16} />} />
        <StatTile label="Seats" value={String(totalSeats)} icon={<Users size={16} />} />
        <StatTile
          label="Trip earnings"
          value={formatNaira(totalTrip)}
          icon={<Banknote size={16} />}
        />
        <StatTile
          label="Cargo earnings"
          value={formatNaira(totalCargo)}
          icon={<Package size={16} />}
        />
        <StatTile
          label="Road expenses"
          value={formatNaira(totalFuel + totalFeeding)}
          hint={`Fuel ${formatNaira(totalFuel)} · Feeding ${formatNaira(totalFeeding)}`}
          icon={<Fuel size={16} />}
        />
        <StatTile
          label="Net to remit"
          value={formatNaira(totalTrip - totalFuel - totalFeeding)}
          hint="Cargo goes to the driver, not included"
          tone="brand"
          icon={<Banknote size={16} />}
        />
      </div>

      {showDaily ? (
      <section className="card p-4">
        <h2 className="mb-4 text-base font-bold text-ink-900">Daily earnings</h2>
        <div className="space-y-2.5">
          {days.map((d) => {
            const rev = revenueByDate.get(d) ?? 0;
            return (
              <div key={d} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-xs font-semibold text-ink-500">
                  {new Intl.DateTimeFormat('en-GB', {
                    timeZone: 'UTC',
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  }).format(new Date(d + 'T00:00:00Z'))}
                </span>
                <div className="bar-track h-6 flex-1">
                  <div
                    className="bar-fill h-6"
                    style={{ width: `${Math.round((rev / maxRevenue) * 100)}%` }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right text-xs font-bold tabular-nums text-ink-800">
                  {formatNaira(rev)}
                </span>
              </div>
            );
          })}
        </div>
      </section>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState>No trips in this period.</EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Driver</th>
                <th>Bus</th>
                <th className="num">Trips</th>
                <th className="num">Seats</th>
                <th className="num">Trip (NGN)</th>
                <th className="num">Cargo (NGN)</th>
                <th className="num">Expenses (NGN)</th>
                <th className="num">Total (NGN)</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => (
                <tr key={r.driverId}>
                  <td className="font-semibold whitespace-nowrap">{r.driverName}</td>
                  <td className="whitespace-nowrap text-ink-600">{r.busLabel ?? '-'}</td>
                  <td className="num">{r.tripCount}</td>
                  <td className="num">{r.seats}</td>
                  <td className="num">{formatNaira(r.tripAmount)}</td>
                  <td className="num text-ink-600">{formatNaira(r.cargoAmount)}</td>
                  <td className="num text-ink-600">
                    {formatNaira(r.fuelAmount + r.feedingAmount)}
                  </td>
                  <td className="num font-bold">
                    {formatNaira(r.tripAmount - r.fuelAmount - r.feedingAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>Total</td>
                <td className="num">{totalTrips}</td>
                <td className="num">{totalSeats}</td>
                <td className="num">{formatNaira(totalTrip)}</td>
                <td className="num">{formatNaira(totalCargo)}</td>
                <td className="num">{formatNaira(totalFuel + totalFeeding)}</td>
                <td className="num font-bold">
                  {formatNaira(totalTrip - totalFuel - totalFeeding)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <Pagination
        basePath="/admin/reports"
        page={page}
        totalPages={totalPages}
        totalItems={rows.length}
        pageSize={PAGE_SIZE}
        extra={rangeExtra}
      />
    </main>
  );
}
