import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { ArrowRight, BadgeCheck, BusFront, CalendarDays, Clock, MapPin, Package, Wallet } from 'lucide-react';
import { db } from '@/db';
import { trips } from '@/db/schema';
import { requireDriver } from '@/lib/auth';
import { formatDate, formatNaira, formatTime12, formatDateTimeWAT } from '@/lib/time';

export const metadata = { title: 'Report' };

export default async function DriverTripReceipt({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireDriver();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const rows = await db
    .select()
    .from(trips)
    .where(and(eq(trips.id, id), eq(trips.driverId, session.driverId)));
  const trip = rows[0];
  if (!trip) notFound();

  const seatsTotal = trip.tripAmountNgn * trip.seatsLoaded;
  const total = seatsTotal + (trip.cargoAmountNgn ?? 0);

  return (
    <main>
      <Link
        href="/driver"
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-500 hover:text-ink-800"
      >
        <ArrowRight size={14} className="rotate-180" />
        Home
      </Link>

      {trip.isVoided ? (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          <span>
            This report was cancelled by admin
            {trip.voidReason ? `: ${trip.voidReason}` : ''}.
          </span>
        </div>
      ) : (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">
          <BadgeCheck size={17} />
          Report saved and sent to management
        </div>
      )}

      {/* Route hero */}
      <div className="hero rounded-2xl p-5 text-white">
        <p className="text-xs font-bold tracking-wide text-brand-100 uppercase">
          {formatDate(trip.tripDate)}
        </p>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-2xl font-extrabold tracking-tight">{trip.fromLocation}</span>
          <ArrowRight size={20} className="shrink-0 text-brand-200" />
          <span className="text-2xl font-extrabold tracking-tight">{trip.toLocation}</span>
        </div>
        <div className="mt-4 flex items-center gap-2 text-sm font-medium text-brand-100">
          <BusFront size={15} />
          {trip.seatsLoaded} seats loaded
        </div>
      </div>

      {/* Money */}
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <div className="card-flat p-4">
          <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-ink-500 uppercase">
            <Wallet size={13} />
            Trip amount
          </div>
          <div className="mt-1.5 text-xl font-extrabold tabular-nums text-ink-900">
            {formatNaira(seatsTotal)}
          </div>
          <div className="mt-0.5 text-xs text-ink-400">
            {formatNaira(trip.tripAmountNgn)} per seat x {trip.seatsLoaded}
          </div>
        </div>
        <div className="card-flat p-4">
          <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-ink-500 uppercase">
            <Package size={13} />
            Cargo
          </div>
          <div className="mt-1.5 text-xl font-extrabold tabular-nums text-ink-900">
            {trip.hasCargo ? formatNaira(trip.cargoAmountNgn ?? 0) : 'None'}
          </div>
        </div>
      </div>

      <div className="card-flat mt-2.5 flex items-center justify-between px-4 py-3.5">
        <span className="text-sm font-semibold text-ink-600">Total for this trip</span>
        <span className="text-xl font-extrabold tabular-nums text-brand-700">
          {formatNaira(total)} NGN
        </span>
      </div>

      <dl className="card-flat mt-4 divide-y divide-ink-100">
        <Row icon={<CalendarDays size={15} />} label="Trip date" value={formatDate(trip.tripDate)} />
        <Row icon={<Clock size={15} />} label="Arrival" value={formatTime12(trip.arrivalTime)} />
        <Row
          icon={<MapPin size={15} />}
          label="Location stamp"
          value={trip.locationStatus === 'captured' ? 'Recorded' : 'Not captured'}
        />
        <Row
          icon={<BadgeCheck size={15} />}
          label="Filed"
          value={formatDateTimeWAT(trip.submittedAt)}
        />
      </dl>

      <Link href="/driver/new" className="btn btn-primary btn-block btn-lg mt-6">
        File another trip
      </Link>
    </main>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <dt className="flex items-center gap-2 text-sm text-ink-500">
        <span className="text-ink-400">{icon}</span>
        {label}
      </dt>
      <dd className="text-right text-sm font-bold text-ink-900">{value}</dd>
    </div>
  );
}