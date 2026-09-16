'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  ArrowRight,
  Banknote,
  BusFront,
  CalendarDays,
  ExternalLink,
  Fuel,
  MapPin,
  Package,
  TriangleAlert,
  Utensils,
  Users,
  X,
} from 'lucide-react';
import { formatDate, formatDateTimeWAT, formatNaira, formatTime12 } from '@/lib/time';

export type TripModalLocationStatus = 'captured' | 'denied' | 'unavailable' | 'unsupported';

export type TripModalData = {
  id: string;
  driverName: string;
  busLabel: string | null;
  tripDate: string;
  fromLocation: string;
  toLocation: string;
  seatsLoaded: number;
  tripAmountNgn: number;
  hasCargo: boolean;
  cargoAmountNgn: number | null;
  fuelAmountNgn: number;
  feedingAmountNgn: number;
  arrivalTime: string;
  submittedAt: string | Date;
  locationStatus: TripModalLocationStatus;
  lat: number | null;
  lng: number | null;
  accuracyM: number | null;
  locationAddress: string | null;
  isVoided: boolean;
  voidReason: string | null;
};

const LOCATION_NOTES: Record<TripModalLocationStatus, string> = {
  captured: 'Recorded when the report was sent.',
  denied: 'The driver did not allow location access on their phone.',
  unavailable: 'The phone could not get a location at that time.',
  unsupported: 'This phone does not support location.',
};

function ModalShell({ trip, onClose }: { trip: TripModalData; onClose: () => void }) {
  // The row that opens this modal sits inside a <tbody>, so the modal must
  // portal to <body>; a <div> inside the table would break hydration.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const seatsTotal = trip.tripAmountNgn * trip.seatsLoaded;
  const collected = seatsTotal + (trip.hasCargo ? trip.cargoAmountNgn ?? 0 : 0);
  const expenses = trip.fuelAmountNgn + trip.feedingAmountNgn;
  // Cargo goes to the driver, so the company net is seats money minus road expenses.
  const net = seatsTotal - expenses;

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/55 sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Trip details"
        className="fade-up max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-ink-100 bg-white/95 px-5 py-3.5 backdrop-blur">
          <h2 className="text-base font-bold text-ink-900">Trip details</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full text-ink-500 hover:bg-ink-100"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {trip.isVoided ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
              <TriangleAlert size={17} className="mt-0.5 shrink-0" />
              <span>Cancelled by admin{trip.voidReason ? `: ${trip.voidReason}` : ''}</span>
            </div>
          ) : null}

          {/* Who and where */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-extrabold tracking-tight text-ink-900">
                {trip.driverName}
              </span>
              {trip.busLabel ? (
                <span className="chip chip-info">
                  <BusFront size={11} />
                  {trip.busLabel}
                </span>
              ) : null}
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-base font-bold text-ink-800">
              <span>{trip.fromLocation}</span>
              <ArrowRight size={16} className="shrink-0 text-brand-600" />
              <span>{trip.toLocation}</span>
            </div>
            <p className="mt-1.5 text-sm text-ink-500">
              {trip.driverName} arrived at {trip.toLocation} at {formatTime12(trip.arrivalTime)}.
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-400">
              <span className="inline-flex items-center gap-1">
                <CalendarDays size={12} />
                {formatDate(trip.tripDate)}
              </span>
              <span>Filed {formatDateTimeWAT(trip.submittedAt)}</span>
            </p>
          </div>

          {/* Money */}
          <div className="card-flat divide-y divide-ink-100 p-0">
            <Row icon={<Users size={14} />} label="Seats loaded" value={`${trip.seatsLoaded}`} />
            <Row
              icon={<Banknote size={14} />}
              label="Amount per seat"
              value={`${formatNaira(trip.tripAmountNgn)} NGN`}
            />
            <Row
              icon={<Banknote size={14} />}
              label="Seats total"
              value={`${formatNaira(seatsTotal)} NGN`}
              hint={`${formatNaira(trip.tripAmountNgn)} x ${trip.seatsLoaded} seats`}
            />
            <Row
              icon={<Package size={14} />}
              label="Cargo"
              value={trip.hasCargo ? `${formatNaira(trip.cargoAmountNgn ?? 0)} NGN` : 'None'}
            />
            <Row
              icon={<Fuel size={14} />}
              label="Fuel bought"
              value={trip.fuelAmountNgn > 0 ? `${formatNaira(trip.fuelAmountNgn)} NGN` : 'None'}
            />
            <Row
              icon={<Utensils size={14} />}
              label="Feeding"
              value={
                trip.feedingAmountNgn > 0 ? `${formatNaira(trip.feedingAmountNgn)} NGN` : 'None'
              }
            />
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm font-bold text-brand-800">Total collected</span>
              <span className="text-right">
                <span className="block text-lg font-extrabold tabular-nums text-brand-700">
                  {formatNaira(collected)} NGN
                </span>
                {expenses > 0 ? (
                  <span className="block text-[11px] font-semibold text-ink-400">
                    plus {formatNaira(expenses)} NGN expenses on the road
                  </span>
                ) : null}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm font-bold text-ink-600">
                Net profit
                <span className="block text-[11px] font-semibold text-ink-400">
                  Cargo goes to the driver, not included
                </span>
              </span>
              <span className="text-sm font-extrabold tabular-nums text-ink-900">
                {formatNaira(net)} NGN
              </span>
            </div>
          </div>

          {/* Current location */}
          <section className="card-flat p-4">
            <h3 className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-ink-500 uppercase">
              <MapPin size={14} className="text-brand-600" />
              Current location
            </h3>
            {trip.locationStatus === 'captured' && trip.lat !== null && trip.lng !== null ? (
              <>
                <p className="mt-2 text-sm text-ink-600">{LOCATION_NOTES.captured}</p>
                {trip.locationAddress ? (
                  <p className="mt-2 text-sm font-semibold text-ink-900">{trip.locationAddress}</p>
                ) : null}
                <p className="mt-1 text-xs tabular-nums text-ink-400">
                  {trip.lat.toFixed(5)}, {trip.lng.toFixed(5)}
                  {trip.accuracyM ? ` (about ${Math.round(trip.accuracyM)} m accurate)` : ''}
                </p>
                <a
                  href={`https://www.google.com/maps?q=${trip.lat},${trip.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-outline btn-sm mt-3"
                >
                  <MapPin size={14} />
                  Open in Google Maps
                  <ExternalLink size={12} />
                </a>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-ink-600">{LOCATION_NOTES[trip.locationStatus]}</p>
                <span className="chip chip-info mt-2">Location not captured</span>
              </>
            )}
          </section>

          <Link href={`/admin/trips/${trip.id}`} className="btn btn-dark btn-block">
            Open full report
          </Link>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Row({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <span className="flex items-center gap-2 text-sm text-ink-500">
        <span className="text-ink-400">{icon}</span>
        {label}
        {hint ? <span className="text-xs text-ink-400">({hint})</span> : null}
      </span>
      <span className="text-sm font-bold tabular-nums text-ink-900">{value}</span>
    </div>
  );
}

/**
 * A table row that opens the trip detail modal when clicked. Cells are
 * passed through as children; avoid putting links inside them.
 */
export function TripModalRow({
  trip,
  children,
  className = '',
}: {
  trip: TripModalData;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr
        className={`${className} cursor-pointer`}
        onClick={() => setOpen(true)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {children}
      </tr>
      {open ? <ModalShell trip={trip} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
