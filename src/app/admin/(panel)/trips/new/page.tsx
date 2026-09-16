import { redirect } from 'next/navigation';
import { eq, and } from 'drizzle-orm';
import { TriangleAlert } from 'lucide-react';
import { db } from '@/db';
import { drivers, users, buses } from '@/db/schema';
import { requireAdmin } from '@/lib/auth';
import { createTripForDriver } from '@/app/actions/trips';
import { lagosToday } from '@/lib/time';
import { SubmitButton } from '@/components/submit-button';

export const metadata = { title: 'File for a driver' };

export default async function AdminNewTrip({
  searchParams,
}: {
  searchParams: Promise<{ driver?: string; error?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const driverList = await db
    .select({
      id: drivers.id,
      name: users.name,
      busLabel: buses.label,
    })
    .from(drivers)
    .innerJoin(users, eq(drivers.userId, users.id))
    .leftJoin(buses, eq(drivers.assignedBusId, buses.id))
    .where(and(eq(drivers.status, 'active'), eq(users.isActive, true)))
    .orderBy(users.name);

  return (
    <main className="max-w-2xl space-y-4">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">
          File a report for a driver
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          For when a driver calls in or their phone is dead. The record will show it was entered by
          admin.
        </p>
      </header>

      {sp.error ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          <TriangleAlert size={17} className="mt-0.5 shrink-0" />
          <span>{sp.error}</span>
        </div>
      ) : null}

      <form
        action={async (formData: FormData) => {
          'use server';
          const result = await createTripForDriver(formData);
          if (result.ok) {
            redirect('/admin/trips?from=' + lagosToday() + '&to=' + lagosToday());
          }
          redirect('/admin/trips/new?error=' + encodeURIComponent(result.error));
        }}
        className="card grid gap-3 p-4 sm:grid-cols-2"
      >
        <label className="block sm:col-span-2">
          <span className="label">Driver</span>
          <select name="driverId" required defaultValue={sp.driver ?? ''} className="field">
            <option value="">Choose a driver</option>
            {driverList.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.busLabel ? ` (${d.busLabel})` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Trip date</span>
          <input type="date" name="tripDate" defaultValue={lagosToday()} className="field" />
        </label>
        <label className="block">
          <span className="label">Seats loaded</span>
          <input type="number" name="seatsLoaded" min={0} max={100} required className="field" />
        </label>
        <label className="block">
          <span className="label">Route from</span>
          <input name="fromLocation" required placeholder="Enugu" className="field" />
        </label>
        <label className="block">
          <span className="label">Route to</span>
          <input name="toLocation" required placeholder="Nsukka" className="field" />
        </label>
        <label className="block">
          <span className="label">Amount per seat (NGN)</span>
          <input type="number" name="tripAmountNgn" min={0} required className="field" />
          <span className="mt-1 block text-xs text-ink-400">
            The full amount is this times the number of seats.
          </span>
        </label>
        <label className="block">
          <span className="label">Cargo amount (NGN)</span>
          <input type="number" name="cargoAmountNgn" min={0} className="field" />
        </label>
        <label className="block">
          <span className="label">Cargo loaded?</span>
          <select name="hasCargo" defaultValue="no" className="field">
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </label>
        <label className="block">
          <span className="label">Fuel bought (NGN)</span>
          <input type="number" name="fuelAmountNgn" min={0} defaultValue="" className="field" />
        </label>
        <label className="block">
          <span className="label">Feeding (NGN)</span>
          <input type="number" name="feedingAmountNgn" min={0} defaultValue="" className="field" />
        </label>
        <label className="block">
          <span className="label">Arrival time</span>
          <input type="time" name="arrivalTime" required className="field" />
        </label>
        <div className="sm:col-span-2">
          <SubmitButton pendingLabel="Saving...">Save report</SubmitButton>
        </div>
      </form>
    </main>
  );
}