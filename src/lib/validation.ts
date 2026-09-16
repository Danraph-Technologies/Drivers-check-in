import { z } from 'zod';

export const phoneSchema = z
  .string()
  .transform((s) => s.replace(/\D/g, ''))
  .pipe(z.string().min(10).max(13));

export const pinSchema = z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits');

export const adminLoginSchema = z.object({
  email: z.string().email().transform((s) => s.trim().toLowerCase()),
  password: z.string().min(1),
});

export const tripBase = {
  tripDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date')
    .refine((d) => {
      const today = new Date();
      const t = new Date(today.toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' }));
      const dt = new Date(d + 'T00:00:00Z');
      const diffDays = Math.round((t.getTime() - dt.getTime()) / 86400000);
      return diffDays >= 0 && diffDays <= 14;
    }, 'Trip date must be today or within the last 14 days'),
  fromLocation: z.string().trim().min(1, 'Enter where the trip started').max(80),
  toLocation: z.string().trim().min(1, 'Enter where the trip ended').max(80),
  seatsLoaded: z.coerce.number().int().min(0, 'Seats cannot be negative').max(100),
  tripAmountNgn: z.coerce.number().int().min(0).max(50_000_000),
  hasCargo: z.boolean(),
  cargoAmountNgn: z.coerce.number().int().min(0).max(50_000_000).nullable().optional(),
  arrivalTime: z.string().regex(/^\d{2}:\d{2}$/, 'Enter the arrival time'),
  fuelAmountNgn: z.coerce.number().int().min(0).max(50_000_000),
  feedingAmountNgn: z.coerce.number().int().min(0).max(50_000_000),
  clientRef: z.string().uuid(),
};

export const tripReportSchema = z
  .object(tripBase)
  .refine((d) => d.hasCargo === false || (d.cargoAmountNgn ?? 0) > 0 || d.cargoAmountNgn === 0, {
    message: 'Enter the cargo amount',
    path: ['cargoAmountNgn'],
  })
  .refine((d) => d.fromLocation.toLowerCase() !== d.toLocation.toLowerCase(), {
    message: 'From and To cannot be the same place',
    path: ['toLocation'],
  });

export const editTripSchema = z.object({
  tripDate: tripBase.tripDate,
  fromLocation: tripBase.fromLocation,
  toLocation: tripBase.toLocation,
  seatsLoaded: tripBase.seatsLoaded,
  tripAmountNgn: tripBase.tripAmountNgn,
  hasCargo: z.boolean(),
  cargoAmountNgn: z.coerce.number().int().min(0).max(50_000_000).nullable().optional(),
  arrivalTime: tripBase.arrivalTime,
  fuelAmountNgn: tripBase.fuelAmountNgn,
  feedingAmountNgn: tripBase.feedingAmountNgn,
  note: z.string().trim().min(3, 'Give a short reason for the change'),
});

export const createDriverSchema = z.object({
  name: z.string().trim().min(2, 'Enter the driver name').max(80),
  phone: phoneSchema,
  busId: z.string().uuid().nullable().optional(),
});

export const updateDriverSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: phoneSchema,
  busId: z.string().uuid().nullable(),
  status: z.enum(['active', 'inactive']),
});

export const busSchema = z.object({
  label: z.string().trim().min(1, 'Enter the bus label').max(40),
  seatCapacity: z.coerce.number().int().min(1, 'Seats must be at least 1').max(200),
  notes: z.string().trim().max(200).nullable().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export const createAdminSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().email().transform((s) => s.trim().toLowerCase()),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const changePinSchema = z.object({
  currentPin: pinSchema,
  newPin: pinSchema,
});

export const locationPayload = z
  .object({
    status: z.enum(['captured', 'denied', 'unavailable', 'unsupported']),
    lat: z.number().min(-90).max(90).nullable().optional(),
    lng: z.number().min(-180).max(180).nullable().optional(),
    accuracyM: z.number().min(0).max(100000).nullable().optional(),
  })
  .refine(
    (l) => l.status !== 'captured' || (l.lat !== null && l.lng !== null && l.lat !== undefined && l.lng !== undefined),
    { message: 'Captured location needs coordinates' },
  );
