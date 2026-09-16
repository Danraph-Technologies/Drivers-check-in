import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { ArrowRight, Check, Clock, ExternalLink, MapPin, TriangleAlert } from 'lucide-react';
import { db } from '@/db';
import { trips, tripAudit, drivers, users, buses } from '@/db/schema';
import { requireAdmin } from '@/lib/auth';
import { formatDate, formatDateTimeWAT, formatTime12 } from '@/lib/time';
import { updateTrip } from '@/app/actions/trips';
import { SubmitButton } from '@/components/submit-button';
import { VoidButton } from './VoidButton';

export const metadata = { title: 'Trip detail' };

export default async function AdminTripDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  // Both queries go out as ONE database round trip (neon-http batch).
  const [rows, audit] = await db.batch([
    db
      .select({
        trip: trips,
        driverName: users.name,
        busLabel: buses.label,
        seatCapacity: buses.seatCapacity,
      })
      .from(trips)
      .innerJoin(drivers, eq(trips.driverId, drivers.id))
      .innerJoin(users, eq(drivers.userId, users.id))
      .leftJoin(buses, eq(trips.busId, buses.id))
      .where(eq(trips.id, id)),
    db
      .select({
        action: tripAudit.action,
        note: tripAudit.note,
        changes: tripAudit.changes,
        createdAt: tripAudit.createdAt,
        actorName: users.name,
      })
      .from(tripAudit)
      .innerJoin(users, eq(tripAudit.actorUserId, users.id))
      .where(eq(tripAudit.tripId, id))
      .orderBy(asc(tripAudit.createdAt)),
  ] as const);

  const row = rows[0];
  if (!row) notFound();
  const t = row.trip;

  const seatsTotal = t.tripAmountNgn * t.seatsLoaded;
  const total = seatsTotal + (t.cargoAmountNgn ?? 0);
  const expenses = t.fuelAmountNgn + t.feedingAmountNgn;
  // Cargo goes to the driver, so the company net is seats money minus road expenses.
  const net = seatsTotal - expenses;

  return (
    <main className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/admin/trips"
            className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-ink-500 hover:text-ink-800"
          >
            <ArrowRight size={14} className="rotate-180" />
            All trips
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">
            {row.driverName}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-500">
            <span className="font-semibold text-ink-700">
              {t.fromLocation}
              <span className="mx-1.5 text-ink-300">&rarr;</span>
              {t.toLocation}
            </span>
            <span>{formatDate(t.tripDate)}</span>
            {row.busLabel ? <span className="chip chip-info">{row.busLabel}</span> : null}
            <span>Filed {formatDateTimeWAT(t.submittedAt)}</span>
          </p>
        </div>
        <div className="flex flex-col items-start gap-1.5">
          {t.locationAddress ? (
            <span className="text-xs font-semibold text-ink-600">{t.locationAddress}</span>
          ) : null}
          {t.locationStatus === 'captured' && t.lat !== null && t.lng !== null ? (
            <a
              href={`https://www.google.com/maps?q=${t.lat},${t.lng}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline btn-sm"
            >
              <MapPin size={14} />
              View GPS location
              <ExternalLink size={12} />
            </a>
          ) : (
            <span className="chip chip-info">
              <MapPin size={12} />
              GPS {t.locationStatus}
            </span>
          )}
        </div>
      </header>

      {/* Key numbers */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card-flat p-4">
          <div className="text-[11px] font-bold tracking-wide text-ink-500 uppercase">Seats</div>
          <div className="mt-1 text-2xl font-extrabold tabular-nums text-ink-900">
            {t.seatsLoaded}
          </div>
        </div>
        <div className="card-flat p-4">
          <div className="text-[11px] font-bold tracking-wide text-ink-500 uppercase">
            Per seat
          </div>
          <div className="mt-1 text-2xl font-extrabold tabular-nums text-ink-900">
            {t.tripAmountNgn.toLocaleString('en-NG')}
          </div>
          <div className="mt-1 text-xs text-ink-400">
            {t.seatsLoaded} seats = {(seatsTotal).toLocaleString('en-NG')}
          </div>
        </div>
        <div className="card-flat p-4">
          <div className="text-[11px] font-bold tracking-wide text-ink-500 uppercase">Cargo</div>
          <div className="mt-1 text-2xl font-extrabold tabular-nums text-ink-900">
            {t.hasCargo ? (t.cargoAmountNgn ?? 0).toLocaleString('en-NG') : '-'}
          </div>
        </div>
        <div className="card-flat p-4">
          <div className="text-[11px] font-bold tracking-wide text-ink-500 uppercase">
            Road expenses
          </div>
          <div className="mt-1 text-2xl font-extrabold tabular-nums text-ink-900">
            {expenses > 0 ? expenses.toLocaleString('en-NG') : '-'}
          </div>
          <div className="mt-1 text-xs text-ink-400">
            Fuel {t.fuelAmountNgn.toLocaleString('en-NG')} · Feeding{' '}
            {t.feedingAmountNgn.toLocaleString('en-NG')}
          </div>
        </div>
        <div className="card border-brand-200 bg-gradient-to-b from-brand-50 to-white p-4">
          <div className="text-[11px] font-bold tracking-wide text-brand-700 uppercase">
            Total collected
          </div>
          <div className="mt-1 text-2xl font-extrabold tabular-nums text-brand-800">
            {total.toLocaleString('en-NG')}
          </div>
          {expenses > 0 ? (
            <div className="mt-1 text-xs text-ink-400">
              plus {expenses.toLocaleString('en-NG')} NGN expenses on the road
            </div>
          ) : null}
        </div>
        <div className="card border-brand-200 bg-gradient-to-b from-brand-50 to-white p-4">
          <div className="text-[11px] font-bold tracking-wide text-brand-700 uppercase">
            Net profit
          </div>
          <div className="mt-1 text-2xl font-extrabold tabular-nums text-brand-800">
            {net.toLocaleString('en-NG')}
          </div>
          <div className="mt-1 text-xs text-ink-400">Trip earnings minus road expenses. Since cargo goes to the driver, not the company.</div>
        </div>
      </div>

      {sp.saved ? (
        <div className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">
          <Check size={17} />
          Changes saved.
        </div>
      ) : null}
      {sp.error ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          <TriangleAlert size={17} className="mt-0.5 shrink-0" />
          <span>{sp.error}</span>
        </div>
      ) : null}
      {t.isVoided ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          <TriangleAlert size={17} className="mt-0.5 shrink-0" />
          <span>This report is voided. Reason: {t.voidReason}</span>
        </div>
      ) : null}
      {t.locationMismatch ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
          <TriangleAlert size={17} className="mt-0.5 shrink-0" />
          <span>
            GPS far from route: the phone location recorded with this report is far from both
            ends of the claimed route.
          </span>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <section className="card p-4">
          <h2 className="mb-4 text-base font-bold text-ink-900">Edit report</h2>
          <form
            action={async (formData: FormData) => {
              'use server';
              const result = await updateTrip(formData);
              const { redirect } = await import('next/navigation');
              redirect(
                result.ok
                  ? `/admin/trips/${id}?saved=1`
                  : `/admin/trips/${id}?error=${encodeURIComponent(result.error)}`,
              );
            }}
            className="grid gap-3 sm:grid-cols-2"
          >
            <input type="hidden" name="tripId" value={id} />
            <label className="block">
              <span className="label">Trip date</span>
              <input type="date" name="tripDate" defaultValue={t.tripDate} className="field" />
            </label>
            <label className="block">
              <span className="label">Seats loaded</span>
              <input
                type="number"
                name="seatsLoaded"
                min={0}
                max={100}
                defaultValue={t.seatsLoaded}
                className="field"
              />
            </label>
            <label className="block">
              <span className="label">Route from</span>
              <input name="fromLocation" defaultValue={t.fromLocation} className="field" />
            </label>
            <label className="block">
              <span className="label">Route to</span>
              <input name="toLocation" defaultValue={t.toLocation} className="field" />
            </label>
            <label className="block">
              <span className="label">Amount per seat (NGN)</span>
              <input
                type="number"
                name="tripAmountNgn"
                min={0}
                defaultValue={t.tripAmountNgn}
                className="field"
              />
            </label>
            <label className="block">
              <span className="label">Cargo amount (NGN)</span>
              <input
                type="number"
                name="cargoAmountNgn"
                min={0}
                defaultValue={t.cargoAmountNgn ?? ''}
                className="field"
              />
            </label>
            <label className="block">
              <span className="label">Fuel bought (NGN)</span>
              <input
                type="number"
                name="fuelAmountNgn"
                min={0}
                defaultValue={t.fuelAmountNgn || ''}
                className="field"
              />
            </label>
            <label className="block">
              <span className="label">Feeding (NGN)</span>
              <input
                type="number"
                name="feedingAmountNgn"
                min={0}
                defaultValue={t.feedingAmountNgn || ''}
                className="field"
              />
            </label>
            <label className="block">
              <span className="label">Arrival</span>
              <input
                type="time"
                name="arrivalTime"
                defaultValue={t.arrivalTime.slice(0, 5)}
                className="field"
              />
            </label>
            <label className="block">
              <span className="label">Cargo loaded?</span>
              <select name="hasCargo" defaultValue={t.hasCargo ? 'yes' : 'no'} className="field">
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="label">Reason for the change (required)</span>
              <textarea
                name="note"
                rows={2}
                required
                minLength={3}
                placeholder="e.g. Driver called, actual seats was 12"
                className="field"
              />
            </label>
            <div className="sm:col-span-2">
              <SubmitButton pendingLabel="Saving...">Save changes</SubmitButton>
            </div>
          </form>

          <VoidButton tripId={id} voided={t.isVoided} />
        </section>

        <section className="card h-fit p-4">
          <h2 className="mb-4 text-base font-bold text-ink-900">History</h2>
          <ol className="space-y-4">
            {audit.map((a, i) => (
              <li key={i} className="relative border-l-2 border-ink-200 pl-4">
                <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-brand-500" />
                <div className="flex items-center gap-2">
                  <span className="chip chip-info capitalize">{a.action}</span>
                  <span className="text-xs text-ink-500">by {a.actorName}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-1 text-xs text-ink-400">
                  <Clock size={11} />
                  {formatDateTimeWAT(a.createdAt)}
                </div>
                <div className="mt-1.5 text-sm text-ink-700">{a.note}</div>
                {a.changes ? (
                  <ul className="mt-2 space-y-1 rounded-lg bg-ink-50 p-2.5 text-xs text-ink-600">
                    {Object.entries(a.changes as Record<string, { from: unknown; to: unknown }>).map(
                      ([field, change]) => (
                        <li key={field}>
                          <span className="font-semibold text-ink-800">{field}</span>:{' '}
                          {String(change.from)} &rarr; {String(change.to)}
                        </li>
                      ),
                    )}
                  </ul>
                ) : null}
              </li>
            ))}
          </ol>
          <div className="mt-4 hairline pt-3 text-xs text-ink-400">
            Arrival {formatTime12(t.arrivalTime)}
          </div>
        </section>
      </div>
    </main>
  );
}