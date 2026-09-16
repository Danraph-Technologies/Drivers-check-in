import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq, desc, sql } from 'drizzle-orm';
import { ArrowRight, BadgeCheck, KeyRound, MapPin, TriangleAlert } from 'lucide-react';
import { db } from '@/db';
import { drivers, users, buses, trips } from '@/db/schema';
import { requireAdmin } from '@/lib/auth';
import { updateDriver, resetDriverPin } from '@/app/actions/trips';
import { SubmitButton } from '@/components/submit-button';
import { formatDate, formatNaira, lagosToday } from '@/lib/time';
import { Pagination } from '@/components/pagination';
import { ResetPinButton } from './PinControls';

export const metadata = { title: 'Driver' };

export default async function AdminDriverDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string; page?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const PAGE_SIZE = 10;
  const rawPage = Math.max(1, Number(sp.page) || 1);

  // Driver + bus options + trip count + one page of trips in ONE round
  // trip; the offset is clamped inside the SQL so a page past the end
  // still returns the last page's rows.
  const [rows, busList, tripPageRows] = await db.batch([
    db
      .select({
        driver: drivers,
        name: users.name,
        isActive: users.isActive,
        busLabel: buses.label,
      })
      .from(drivers)
      .innerJoin(users, eq(drivers.userId, users.id))
      .leftJoin(buses, eq(drivers.assignedBusId, buses.id))
      .where(eq(drivers.id, id)),
    db.select().from(buses).orderBy(buses.label),
    db
      .select({
        total: sql<number>`count(*) OVER ()::int`,
        id: trips.id,
        tripDate: trips.tripDate,
        from: trips.fromLocation,
        to: trips.toLocation,
        seats: trips.seatsLoaded,
        tripAmount: trips.tripAmountNgn,
        isVoided: trips.isVoided,
      })
      .from(trips)
      .where(eq(trips.driverId, id))
      .orderBy(desc(trips.tripDate), desc(trips.submittedAt))
      .limit(PAGE_SIZE)
      .offset(
        // Clamp a too-far page to the last one, inside the SQL.
        sql<number>`LEAST(${rawPage - 1}::int * ${PAGE_SIZE}::int, GREATEST((SELECT count(*) FROM ${trips} WHERE ${trips.driverId} = ${id}) - ${PAGE_SIZE}::int, 0))::int` as unknown as number,
      ),
  ] as const);

  const row = rows[0];
  if (!row) notFound();
  const d = row.driver;
  const total = tripPageRows[0]?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(rawPage, totalPages);
  const recentTrips = tripPageRows;

  const today = lagosToday();
  const reportedToday =
    page === 1 && recentTrips.some((t) => t.tripDate === today && !t.isVoided);
  const isActive = d.status === 'active' && row.isActive;

  return (
    <main className="space-y-5">
      <header>
        <Link
          href="/admin/drivers"
          className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-ink-500 hover:text-ink-800"
        >
          <ArrowRight size={14} className="rotate-180" />
          All drivers
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">{row.name}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="chip chip-info tabular-nums">{d.phone}</span>
          {row.busLabel ? <span className="chip chip-info">{row.busLabel}</span> : null}
          {isActive ? (
            <span className="chip chip-ok">Active</span>
          ) : (
            <span className="chip chip-bad">Inactive</span>
          )}
          {reportedToday ? (
            <span className="chip chip-ok">
              <BadgeCheck size={12} />
              Reported today
            </span>
          ) : (
            <span className="chip chip-warn">Has not reported today</span>
          )}
        </p>
      </header>

      {sp.saved ? (
        <div className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">
          <BadgeCheck size={17} />
          Driver updated.
        </div>
      ) : null}
      {sp.error ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          <TriangleAlert size={17} className="mt-0.5 shrink-0" />
          <span>{sp.error}</span>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-4 text-base font-bold text-ink-900">Driver details</h2>
          <form
            action={async (formData: FormData) => {
              'use server';
              const result = await updateDriver(formData);
              const { redirect } = await import('next/navigation');
              redirect(
                result.ok
                  ? `/admin/drivers/${id}?saved=1`
                  : `/admin/drivers/${id}?error=${encodeURIComponent(result.error)}`,
              );
            }}
            className="space-y-3"
          >
            <input type="hidden" name="driverId" value={id} />
            <label className="block">
              <span className="label">Full name</span>
              <input name="name" defaultValue={row.name} required className="field" />
            </label>
            <label className="block">
              <span className="label">Phone number</span>
              <input
                name="phone"
                type="tel"
                defaultValue={d.phone}
                required
                className="field tabular-nums"
              />
            </label>
            <label className="block">
              <span className="label">Assigned bus</span>
              <select name="busId" defaultValue={d.assignedBusId ?? ''} className="field">
                <option value="">No bus</option>
                {busList.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label} ({b.seatCapacity} seats)
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">Status</span>
              <select name="status" defaultValue={d.status} className="field">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <SubmitButton pendingLabel="Saving...">
              Save changes
            </SubmitButton>
          </form>

          <div className="mt-5 hairline pt-4">
            <h3 className="mb-1 flex items-center gap-1.5 text-sm font-bold text-ink-900">
              <KeyRound size={14} className="text-brand-600" />
              PIN
            </h3>
            <p className="mb-3 text-sm text-ink-500">
              Give the new PIN to the driver. They sign in with their phone number and this PIN.
            </p>
            <ResetPinButton
              resetAction={async () => {
                'use server';
                const result = await resetDriverPin(id);
                return result.ok ? result.pin : null;
              }}
            />
          </div>
        </section>

        <section className="card h-fit p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-ink-900">Recent reports</h2>
            <Link
              href={`/admin/trips/new?driver=${id}`}
              className="btn btn-outline btn-sm"
            >
              File for this driver
            </Link>
          </div>

          {recentTrips.length === 0 ? (
            <p className="rounded-xl border border-dashed border-ink-200 px-4 py-8 text-center text-sm text-ink-500">
              No reports yet.
            </p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {recentTrips.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/admin/trips/${t.id}`}
                    className={`flex items-center gap-3 py-2.5 hover:opacity-80 ${
                      t.isVoided ? 'opacity-50 line-through' : ''
                    }`}
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink-50 text-ink-400">
                      <MapPin size={14} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink-900">
                        {t.from} to {t.to}
                      </span>
                      <span className="block text-xs text-ink-500">
                        {formatDate(t.tripDate)} &middot; {t.seats} seats
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-ink-800">
                      {formatNaira(t.tripAmount)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4">
            <Pagination
              basePath={`/admin/drivers/${id}`}
              page={page}
              totalPages={totalPages}
              totalItems={total}
              pageSize={PAGE_SIZE}
              extra={sp.saved ? { saved: sp.saved } : undefined}
            />
          </div>
        </section>
      </div>
    </main>
  );
}