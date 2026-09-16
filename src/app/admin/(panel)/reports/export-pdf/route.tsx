import { and, eq, gte, lte, sql, asc, desc } from 'drizzle-orm';
import { renderToBuffer } from '@react-pdf/renderer';
import { db } from '@/db';
import { trips, drivers, users, buses } from '@/db/schema';
import { getSession } from '@/lib/auth';
import { formatDate, lagosNowTime, formatTime12 } from '@/lib/time';
import { ActivityReportDocument, type PdfTripRow, type PdfDriverRow } from '@/lib/pdf/activity-report';
import { LOGO_DATA_URI } from '@/lib/pdf/logo-data';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(request.url);
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const from = url.searchParams.get('from') || today;
  const to = url.searchParams.get('to') || today;

  // Batched as one database round trip (neon-http).
  const [rows, daily] = await db.batch([
    db
      .select({
        tripDate: trips.tripDate,
        driverName: users.name,
        busLabel: buses.label,
        from: trips.fromLocation,
        to: trips.toLocation,
        seats: trips.seatsLoaded,
        perSeat: trips.tripAmountNgn,
        hasCargo: trips.hasCargo,
        cargoAmount: trips.cargoAmountNgn,
        fuelAmount: trips.fuelAmountNgn,
        feedingAmount: trips.feedingAmountNgn,
        arrival: trips.arrivalTime,
        isVoided: trips.isVoided,
      })
      .from(trips)
      .innerJoin(drivers, eq(trips.driverId, drivers.id))
      .innerJoin(users, eq(drivers.userId, users.id))
      .leftJoin(buses, eq(trips.busId, buses.id))
      .where(and(gte(trips.tripDate, from), lte(trips.tripDate, to)))
      .orderBy(asc(trips.tripDate), asc(users.name), desc(trips.submittedAt)),
    db
      .select({
        tripDate: trips.tripDate,
        revenue: sql<number>`coalesce(sum((${trips.tripAmountNgn} * ${trips.seatsLoaded}) + coalesce(${trips.cargoAmountNgn}, 0)), 0)::int`,
      })
      .from(trips)
      .where(
        and(
          eq(trips.isVoided, false),
          gte(trips.tripDate, from),
          lte(trips.tripDate, to),
        ),
      )
      .groupBy(trips.tripDate),
  ] as const);

  const active = rows.filter((r) => !r.isVoided);

  // Per-driver aggregation.
  const byDriver = new Map<
    string,
    { driverName: string; busLabel: string | null; trips: number; seats: number; trip: number; cargo: number; fuel: number; feeding: number; net: number }
  >();
  for (const t of active) {
    const key = t.driverName;
    const d = byDriver.get(key) ?? {
      driverName: t.driverName,
      busLabel: t.busLabel,
      trips: 0,
      seats: 0,
      trip: 0,
      cargo: 0,
      fuel: 0,
      feeding: 0,
      net: 0,
    };
    const seatsTotal = t.perSeat * t.seats;
    d.trips += 1;
    d.seats += t.seats;
    d.trip += seatsTotal;
    d.cargo += t.cargoAmount ?? 0;
    d.fuel += t.fuelAmount;
    d.feeding += t.feedingAmount;
    d.net += seatsTotal - t.fuelAmount - t.feedingAmount;
    byDriver.set(key, d);
  }
  const driverRows: PdfDriverRow[] = Array.from(byDriver.values()).sort((a, b) =>
    a.driverName.localeCompare(b.driverName),
  );

  const totals = {
    trips: active.length,
    seats: active.reduce((s, t) => s + t.seats, 0),
    tripEarnings: active.reduce((s, t) => s + t.perSeat * t.seats, 0),
    cargoEarnings: active.reduce((s, t) => s + (t.cargoAmount ?? 0), 0),
    fuel: active.reduce((s, t) => s + t.fuelAmount, 0),
    feeding: active.reduce((s, t) => s + t.feedingAmount, 0),
    net: 0,
  };
  totals.net = totals.tripEarnings - totals.fuel - totals.feeding;

  const tripRows: PdfTripRow[] = rows.map((t) => ({
    tripDate: t.tripDate,
    driverName: t.driverName,
    busLabel: t.busLabel,
    from: t.from,
    to: t.to,
    seats: t.seats,
    perSeat: t.perSeat,
    seatsTotal: t.perSeat * t.seats,
    cargo: t.hasCargo ? (t.cargoAmount ?? 0) : 0,
    fuel: t.fuelAmount,
    feeding: t.feedingAmount,
    net: t.perSeat * t.seats - t.fuelAmount - t.feedingAmount,
    arrival: formatTime12(t.arrival),
    isVoided: t.isVoided,
  }));

  const dayRows = daily
    .slice()
    .sort((a, b) => a.tripDate.localeCompare(b.tripDate))
    .map((d) => ({
      day: new Intl.DateTimeFormat('en-GB', {
        timeZone: 'UTC',
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }).format(new Date(d.tripDate + 'T00:00:00Z')),
      revenue: d.revenue,
    }));

  const periodLabel = `${formatDate(from)} to ${formatDate(to)}`;
  const generatedLabel = `${formatDate(today)} at ${formatTime12(lagosNowTime())} (WAT)`;

  const buffer = await renderToBuffer(
    <ActivityReportDocument
      logoDataUri={LOGO_DATA_URI}
      periodLabel={periodLabel}
      generatedLabel={generatedLabel}
      totals={totals}
      drivers={driverRows}
      days={dayRows}
      trips={tripRows}
      voidedCount={rows.length - active.length}
    />,
  );

  return new Response(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="danraph-activity-${from}-to-${to}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
