'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  CalendarDays,
  Check,
  Clock,
  Fuel,
  Loader2,
  MapPin,
  MoveRight,
  Package,
  Plus,
  TriangleAlert,
  Utensils,
  Users,
} from 'lucide-react';
import { submitTripReport } from '@/app/actions/trips';
import { lagosNowTime, formatNaira } from '@/lib/time';

type FormValues = {
  tripDate: string;
  fromLocation: string;
  toLocation: string;
  seatsLoaded: string;
  tripAmountNgn: string;
  hasCargo: 'yes' | 'no';
  cargoAmountNgn: string;
  fuelAmountNgn: string;
  feedingAmountNgn: string;
  arrivalTime: string;
};

type LocationResult = {
  status: 'captured' | 'denied' | 'unavailable' | 'unsupported';
  lat?: number | null;
  lng?: number | null;
  accuracyM?: number | null;
};

function todayInLagos(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** One consistent, thumb-sized field for every input in the form. */
const fieldCls = 'field field-lg';

export default function TripForm({
  busLabel,
  seatCapacity,
  suggestions,
}: {
  busLabel: string | null;
  seatCapacity: number | null;
  suggestions: string[];
}) {
  const [clientRef, setClientRef] = useState(() =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`,
  );
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [locState, setLocState] = useState<'asking' | 'ok' | 'denied' | 'fail'>('asking');
  const locationRef = useRef<LocationResult>({ status: 'unavailable' });

  // Ask for permission the moment the form opens, so the browser prompt
  // shows before the driver has typed anything. Both Android (Chrome) and
  // iPhone (Safari) show it: a request must come from the page itself,
  // which this is. If the driver taps Block, the browser will not ask
  // again on its own - the card below explains how to unblock.
  useEffect(() => {
    let cancelled = false;
    captureLocation().then((loc) => {
      if (cancelled) return;
      locationRef.current = loc;
      if (loc.status === 'captured') setLocState('ok');
      else if (loc.status === 'denied') setLocState('denied');
      else setLocState('fail');
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      tripDate: todayInLagos(),
      fromLocation: '',
      toLocation: '',
      seatsLoaded: '',
      tripAmountNgn: '',
      hasCargo: 'no',
      cargoAmountNgn: '',
      fuelAmountNgn: '',
      feedingAmountNgn: '',
      arrivalTime: '',
    },
  });

  // Restore an unsent draft from this device (offline protection).
  useEffect(() => {
    try {
      const raw = localStorage.getItem('tripDraft:pending');
      if (raw) {
        const d = JSON.parse(raw) as { values: Partial<FormValues>; clientRef: string };
        const keys: (keyof FormValues)[] = [
          'tripDate',
          'fromLocation',
          'toLocation',
          'seatsLoaded',
          'tripAmountNgn',
          'hasCargo',
          'cargoAmountNgn',
          'fuelAmountNgn',
          'feedingAmountNgn',
          'arrivalTime',
        ];
        const hasAnything = keys.some(
          (k) => d.values?.[k] !== undefined && d.values?.[k] !== '' && d.values?.[k] !== null,
        );
        if (hasAnything) {
          for (const k of keys) {
            const v = d.values[k];
            if (v !== undefined && v !== null) {
              setValue(k, v as string);
            }
          }
          // Adopt the draft's original ref so a retry of a half-sent report
          // cannot create a duplicate row.
          if (d.clientRef && d.clientRef !== clientRef) {
            setClientRef(d.clientRef);
          }
          setRestored(true);
        }
      }
    } catch {
      // ignore corrupted drafts
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save a draft on every change.
  useEffect(() => {
    const sub = watch((values) => {
      try {
        localStorage.setItem('tripDraft:pending', JSON.stringify({ values, clientRef }));
      } catch {
        // storage full or blocked; not fatal
      }
    });
    return () => sub.unsubscribe();
  }, [watch, clientRef]);

  const hasCargo = watch('hasCargo') === 'yes';
  const seats = Number(watch('seatsLoaded'));
  const amountPerSeat = Number(watch('tripAmountNgn')) || 0;
  const seatsTotal = Number.isFinite(seats) ? amountPerSeat * seats : 0;
  const overCapacity = seatCapacity !== null && !Number.isNaN(seats) && seats > seatCapacity;

  function captureLocation(): Promise<LocationResult> {
    return new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        resolve({ status: 'unsupported' });
        return;
      }
      const timer = setTimeout(() => {
        console.warn('[location] gave up after 8s waiting for a GPS fix');
        resolve({ status: 'unavailable' });
      }, 8000);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(timer);
          console.info(
            `[location] captured ${pos.coords.latitude.toFixed(5)},${pos.coords.longitude.toFixed(5)} (+-${Math.round(pos.coords.accuracy)}m)`,
          );
          resolve({
            status: 'captured',
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracyM: pos.coords.accuracy,
          });
        },
        (err) => {
          clearTimeout(timer);
          console.warn(`[location] failed: code=${err.code} message=${err.message}`);
          resolve({ status: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable' });
        },
        { timeout: 7000, maximumAge: 30000 },
      );
    });
  }

  const onSubmit = handleSubmit(async (values) => {
    // Belt and braces: the submit button is disabled while saving, but a
    // stale double tap must never send a second report.
    if (status === 'saving') return;
    setError(null);
    setStatus('saving');
    const loc =
      locationRef.current.status === 'captured' ? locationRef.current : await captureLocation();
    locationRef.current = loc;
    if (loc.status === 'captured') setLocState('ok');
    else if (loc.status === 'denied') setLocState('denied');
    else setLocState('fail');

    try {
      const result = await submitTripReport(
        {
          tripDate: values.tripDate,
          fromLocation: values.fromLocation,
          toLocation: values.toLocation,
          seatsLoaded: values.seatsLoaded === '' ? NaN : Number(values.seatsLoaded),
          tripAmountNgn: values.tripAmountNgn === '' ? NaN : Number(values.tripAmountNgn),
          hasCargo: values.hasCargo === 'yes',
          cargoAmountNgn:
            values.hasCargo === 'yes' && values.cargoAmountNgn !== ''
              ? Number(values.cargoAmountNgn)
              : null,
          fuelAmountNgn: values.fuelAmountNgn === '' ? 0 : Number(values.fuelAmountNgn),
          feedingAmountNgn: values.feedingAmountNgn === '' ? 0 : Number(values.feedingAmountNgn),
          arrivalTime: values.arrivalTime,
          clientRef,
        },
        loc,
      );
      if (!result.ok) {
        setError(result.error);
        setStatus('idle');
        return;
      }
      try {
        localStorage.removeItem('tripDraft:pending');
      } catch {}
      setStatus('saved');
    } catch {
      setError(
        'No connection. Your entries are saved on this phone. Press save again when you have network.',
      );
      setStatus('idle');
    }
  });

  if (status === 'saved') {
    const savedSeats = Number(getValues('seatsLoaded')) || 0;
    const savedPerSeat = Number(getValues('tripAmountNgn')) || 0;
    const savedTrip = savedPerSeat * savedSeats;
    const savedCargo = hasCargo ? Number(getValues('cargoAmountNgn')) || 0 : 0;
    return (
      <main className="fade-up">
        <div className="hero rounded-2xl p-6 text-center text-white">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/20">
            <Check size={30} strokeWidth={3} />
          </span>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight">Report saved</h1>
          <p className="mt-1.5 text-sm text-brand-100">
            Management can see this trip now.
          </p>

          <div className="mt-5 flex items-center justify-center gap-2 text-xl font-extrabold tracking-tight">
            <span>{getValues('fromLocation')}</span>
            <ArrowRight size={18} className="text-brand-200" />
            <span>{getValues('toLocation')}</span>
          </div>
        </div>

        <div className="card-flat mt-4 grid grid-cols-3 divide-x divide-ink-100">
          <div className="px-3 py-3.5 text-center">
            <div className="text-lg font-extrabold tabular-nums text-ink-900">{savedSeats}</div>
            <div className="text-[11px] font-bold tracking-wide text-ink-500 uppercase">Seats</div>
          </div>
          <div className="px-3 py-3.5 text-center">
            <div className="text-lg font-extrabold tabular-nums text-ink-900">
              {formatNaira(savedTrip)}
            </div>
            <div className="text-[11px] font-bold tracking-wide text-ink-500 uppercase">Trip</div>
          </div>
          <div className="px-3 py-3.5 text-center">
            <div className="text-lg font-extrabold tabular-nums text-ink-900">
              {savedCargo ? formatNaira(savedCargo) : '-'}
            </div>
            <div className="text-[11px] font-bold tracking-wide text-ink-500 uppercase">Cargo</div>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <a href="/driver/new" className="btn btn-primary btn-block btn-lg">
            <Plus size={18} strokeWidth={3} />
            File another trip
          </a>
          <a href="/driver" className="btn btn-outline btn-block btn-lg">
            Done
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="pb-8">
      <header className="mb-5">
        <a
          href="/driver"
          className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-ink-500 hover:text-ink-800"
        >
          <ArrowRight size={14} className="rotate-180" />
          Home
        </a>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">Trip report</h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-ink-500">
          {busLabel ? (
            <span className="chip chip-info">
              <MapPin size={12} />
              {busLabel}
            </span>
          ) : null}
          Fill this when you have landed.
        </p>
      </header>

      {restored ? (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          <TriangleAlert size={17} className="mt-0.5 shrink-0" />
          <span>We restored your unsent entries from this phone.</span>
        </div>
      ) : null}

      {locState !== 'ok' ? (
        <div
          className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
            locState === 'asking'
              ? 'border-brand-200 bg-brand-50 text-brand-900'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          {locState === 'asking' ? (
            <span className="flex items-start gap-2.5 font-medium">
              <MapPin size={17} className="mt-0.5 shrink-0" />
              <span>
                Allow location when your phone asks. The company records where you landed to
                confirm your trip.
              </span>
            </span>
          ) : null}
          {locState === 'denied' ? (
            <>
              <span className="flex items-start gap-2.5 font-bold">
                <TriangleAlert size={17} className="mt-0.5 shrink-0" />
                <span>Location is turned off for this app.</span>
              </span>
              <span className="mt-1.5 block">
                On Android (Chrome): tap the lock or information icon left of the address bar,
                then Permissions, then Location, then Allow. On iPhone (Safari): open Settings,
                scroll to Safari, then Location, and set it to Ask or Allow while using the
                website.
              </span>
              <button
                type="button"
                onClick={() => {
                  setLocState('asking');
                  captureLocation().then((loc) => {
                    locationRef.current = loc;
                    if (loc.status === 'captured') setLocState('ok');
                    else if (loc.status === 'denied') setLocState('denied');
                    else setLocState('fail');
                  });
                }}
                className="btn btn-outline btn-sm mt-2.5"
              >
                Try again
              </button>
            </>
          ) : null}
          {locState === 'fail' ? (
            <>
              <span className="flex items-start gap-2.5 font-bold">
                <TriangleAlert size={17} className="mt-0.5 shrink-0" />
                <span>Your phone could not get a location just now.</span>
              </span>
              <span className="mt-1.5 block">
                Go outside or near a window with open sky and press Try again. You can still save
                the report, but management may ask about the missing location.
              </span>
              <button
                type="button"
                onClick={() => {
                  setLocState('asking');
                  captureLocation().then((loc) => {
                    locationRef.current = loc;
                    if (loc.status === 'captured') setLocState('ok');
                    else if (loc.status === 'denied') setLocState('denied');
                    else setLocState('fail');
                  });
                }}
                className="btn btn-outline btn-sm mt-2.5"
              >
                Try again
              </button>
            </>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
        >
          <TriangleAlert size={17} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {/* Route */}
        <section className="card p-4">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-bold tracking-wide text-ink-500 uppercase">
            <MoveRight size={14} />
            The trip
          </h2>

          <div className="space-y-4">
            <label className="block">
              <span className="label flex items-center gap-1.5">
                <CalendarDays size={14} className="text-ink-400" />
                Trip date
              </span>
              <input type="date" {...register('tripDate', { required: true })} className={fieldCls} />
              {errors.tripDate ? (
                <span className="mt-1 block text-xs font-medium text-red-700">
                  Choose a valid date
                </span>
              ) : null}
            </label>

            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
              <label className="block">
                <span className="label">From</span>
                <input
                  type="text"
                  list="location-suggestions"
                  {...register('fromLocation', { required: true })}
                  placeholder="Enugu"
                  className={fieldCls}
                />
                {errors.fromLocation ? (
                  <span className="mt-1 block text-xs font-medium text-red-700">Required</span>
                ) : null}
              </label>
              <span className="grid h-[3.05rem] place-items-center text-ink-300" aria-hidden="true">
                <ArrowRight size={18} />
              </span>
              <label className="block">
                <span className="label">To</span>
                <input
                  type="text"
                  list="location-suggestions"
                  {...register('toLocation', { required: true })}
                  placeholder="Nsukka"
                  className={fieldCls}
                />
                {errors.toLocation ? (
                  <span className="mt-1 block text-xs font-medium text-red-700">Required</span>
                ) : null}
              </label>
            </div>
            <datalist id="location-suggestions">
              {suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
        </section>

        {/* Load and money */}
        <section className="card p-4">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-bold tracking-wide text-ink-500 uppercase">
            <Users size={14} />
            Load and money
          </h2>

          <div className="space-y-4">
            <label className="block">
              <span className="label">Seats loaded</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                {...register('seatsLoaded', { required: true })}
                placeholder="Number of passengers"
                className={fieldCls}
              />
              {overCapacity ? (
                <span className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-amber-700">
                  <TriangleAlert size={13} className="mt-0.5 shrink-0" />
                  This bus has {seatCapacity} seats. You can still save the report.
                </span>
              ) : null}
              {errors.seatsLoaded ? (
                <span className="mt-1 block text-xs font-medium text-red-700">
                  Enter the number of seats
                </span>
              ) : null}
            </label>

            <label className="block">
              <span className="label flex items-center gap-1.5">
                <Banknote size={14} className="text-ink-400" />
                Amount per seat (Naira)
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                {...register('tripAmountNgn', { required: true })}
                placeholder="0"
                className={fieldCls}
              />
              {errors.tripAmountNgn ? (
                <span className="mt-1 block text-xs font-medium text-red-700">
                  Enter the amount per seat
                </span>
              ) : null}
              {seatsTotal > 0 ? (
                <span className="mt-2 flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-2.5 text-sm font-bold text-brand-800">
                  Full amount for {Number.isFinite(seats) ? seats : 0} seats
                  <span className="text-base font-extrabold tabular-nums">
                    {formatNaira(seatsTotal)} NGN
                  </span>
                </span>
              ) : null}
            </label>

            <fieldset>
              <legend className="label flex items-center gap-1.5">
                <Package size={14} className="text-ink-400" />
                Was there any cargo load?
              </legend>
              <div className="grid grid-cols-2 gap-3">
                {(['yes', 'no'] as const).map((val) => {
                  const on = watch('hasCargo') === val;
                  return (
                    <label
                      key={val}
                      className={`cursor-pointer rounded-2xl border-2 px-4 py-4 text-center text-lg font-bold transition ${
                        on
                          ? 'border-brand-500 bg-brand-50 text-brand-800'
                          : 'border-ink-200 bg-white text-ink-600'
                      }`}
                    >
                      <input type="radio" value={val} {...register('hasCargo')} className="sr-only" />
                      {val === 'yes' ? 'Yes' : 'No'}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {hasCargo ? (
              <label className="fade-up block">
                <span className="label">Cargo amount (Naira)</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  {...register('cargoAmountNgn')}
                  placeholder="0"
                  className={fieldCls}
                />
                {errors.cargoAmountNgn ? (
                  <span className="mt-1 block text-xs font-medium text-red-700">
                    Enter the cargo amount
                  </span>
                ) : null}
              </label>
            ) : null}
          </div>
        </section>

        {/* Money spent on the road */}
        <section className="card p-4">
          <h2 className="mb-1 flex items-center gap-2 text-xs font-bold tracking-wide text-ink-500 uppercase">
            <Fuel size={14} />
            Money spent on the road
          </h2>
          <p className="mb-3 text-xs text-ink-400">Optional. Leave empty if you spent nothing.</p>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label flex items-center gap-1.5">
                <Fuel size={14} className="text-ink-400" />
                Fuel
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                {...register('fuelAmountNgn')}
                placeholder="0"
                className={fieldCls}
              />
            </label>
            <label className="block">
              <span className="label flex items-center gap-1.5">
                <Utensils size={14} className="text-ink-400" />
                Feeding
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                {...register('feedingAmountNgn')}
                placeholder="0"
                className={fieldCls}
              />
            </label>
          </div>
        </section>

        {/* Arrival time */}
        <section className="card p-4">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-bold tracking-wide text-ink-500 uppercase">
            <Clock size={14} />
            Time
          </h2>

          <label className="block">
            <span className="label">Arrival time</span>
            <input
              type="time"
              {...register('arrivalTime', { required: true })}
              className={fieldCls}
            />
            {errors.arrivalTime ? (
              <span className="mt-1 block text-xs font-medium text-red-700">
                Enter the arrival time
              </span>
            ) : null}
          </label>

          <button
            type="button"
            onClick={() => setValue('arrivalTime', lagosNowTime())}
            className="btn btn-outline mt-3"
          >
            Arrival is now
          </button>
        </section>

        <button
          type="submit"
          disabled={status === 'saving'}
          aria-busy={status === 'saving'}
          className="btn btn-primary btn-block btn-xl"
        >
          {status === 'saving' ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <BadgeCheck size={20} />
              Save report
            </>
          )}
        </button>
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-ink-400">
          <MapPin size={12} />
          Your phone location may be recorded with this report.
        </p>
      </form>
    </main>
  );
}
