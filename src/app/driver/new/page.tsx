import { requireDriver } from '@/lib/auth';
import { db } from '@/db';
import { buses, drivers, trips } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import TripForm from './TripForm';

export const metadata = { title: 'File trip report' };

export default async function NewTripPage() {
  const session = await requireDriver();

  // Both queries go out as ONE database round trip (neon-http batch).
  const [rows, recent] = await db.batch([
    db
      .select({
        busLabel: buses.label,
        seatCapacity: buses.seatCapacity,
      })
      .from(drivers)
      .leftJoin(buses, eq(drivers.assignedBusId, buses.id))
      .where(eq(drivers.id, session.driverId)),
    // Recent locations from this driver's own trips, for typeahead suggestions.
    db
      .select({ from: trips.fromLocation, to: trips.toLocation })
      .from(trips)
      .where(eq(trips.driverId, session.driverId))
      .orderBy(desc(trips.submittedAt))
      .limit(30),
  ] as const);
  const bus = rows[0];

  const seen = new Set<string>();
  const suggestions: string[] = [];
  for (const r of recent) {
    for (const loc of [r.from, r.to]) {
      const key = loc.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        suggestions.push(loc);
      }
    }
  }

  return (
    <TripForm
      busLabel={bus?.busLabel ?? null}
      seatCapacity={bus?.seatCapacity ?? null}
      suggestions={suggestions}
    />
  );
}