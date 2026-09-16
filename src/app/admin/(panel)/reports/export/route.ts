import { and, eq, gte, lte, asc } from 'drizzle-orm';
import { db } from '@/db';
import { trips, drivers, users, buses } from '@/db/schema';
import { getSession } from '@/lib/auth';
import { lagosToday } from '@/lib/time';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(request.url);
  const from = url.searchParams.get('from') || lagosToday();
  const to = url.searchParams.get('to') || lagosToday();

  const rows = await db
    .select({
      tripDate: trips.tripDate,
      driverName: users.name,
      busLabel: buses.label,
      from: trips.fromLocation,
      to: trips.toLocation,
      seats: trips.seatsLoaded,
      tripAmount: trips.tripAmountNgn,
      hasCargo: trips.hasCargo,
      cargoAmount: trips.cargoAmountNgn,
      fuelAmount: trips.fuelAmountNgn,
      feedingAmount: trips.feedingAmountNgn,
      arrival: trips.arrivalTime,
      submittedAt: trips.submittedAt,
      locationStatus: trips.locationStatus,
      locationAddress: trips.locationAddress,
      lat: trips.lat,
      lng: trips.lng,
      isVoided: trips.isVoided,
      voidReason: trips.voidReason,
    })
    .from(trips)
    .innerJoin(drivers, eq(trips.driverId, drivers.id))
    .innerJoin(users, eq(drivers.userId, users.id))
    .leftJoin(buses, eq(trips.busId, buses.id))
    .where(and(gte(trips.tripDate, from), lte(trips.tripDate, to)))
    .orderBy(asc(trips.tripDate), asc(users.name));

  const header = [
    'Trip Date',
    'Driver',
    'Bus',
    'From',
    'To',
    'Seats',
    'Amount Per Seat (NGN)',
    'Seats Total (NGN)',
    'Cargo',
    'Cargo Amount (NGN)',
    'Fuel (NGN)',
    'Feeding (NGN)',
    'Total Collected (NGN)',
    'Fuel + Feeding (NGN)',
    'Net Profit (NGN, Cargo Excluded)',
    'Arrival',
    'Submitted (WAT)',
    'Location',
    'Status',
  ];

  const wat = (d: Date) =>
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Lagos',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);

  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;

  const lines = [header.map(escape).join(',')];
  for (const t of rows) {
    const coords =
      t.lat !== null && t.lng !== null ? `${t.lat.toFixed(5)},${t.lng.toFixed(5)}` : '';
    const location =
      [t.locationAddress ?? '', coords].filter(Boolean).join(' | ') || t.locationStatus;
    lines.push(
      [
        t.tripDate,
        t.driverName,
        t.busLabel ?? '',
        t.from,
        t.to,
        String(t.seats),
        String(t.tripAmount),
        String(t.tripAmount * t.seats),
        t.hasCargo ? 'Yes' : 'No',
        t.cargoAmount !== null ? String(t.cargoAmount) : '',
        String(t.fuelAmount),
        String(t.feedingAmount),
        String(t.tripAmount * t.seats + (t.cargoAmount ?? 0)),
        String(t.fuelAmount + t.feedingAmount),
        String(t.tripAmount * t.seats - t.fuelAmount - t.feedingAmount),
        t.arrival.slice(0, 5),
        wat(t.submittedAt),
        location,
        t.isVoided ? `Voided: ${t.voidReason ?? ''}` : 'Active',
      ]
        .map(escape)
        .join(','),
    );
  }

  // UTF-8 BOM so Excel opens it with correct encoding.
  const csv = '﻿' + lines.join('\r\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="danraph-trips-${from}-to-${to}.csv"`,
    },
  });
}
