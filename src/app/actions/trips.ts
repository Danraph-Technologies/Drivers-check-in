'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { trips, tripAudit, drivers, buses, users } from '@/db/schema';
import { requireAdmin, requireDriver, hashSecret, verifySecret } from '@/lib/auth';
import { reverseGeocode } from '@/lib/geocode';
import {
  tripReportSchema,
  editTripSchema,
  createDriverSchema,
  updateDriverSchema,
  busSchema,
  createAdminSchema,
} from '@/lib/validation';


function formatZodError(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? 'Invalid input';
}

export type ActionResult = { ok: true } | { ok: false; error: string };

// ---------- Trips ----------

export async function submitTripReport(input: unknown, location: unknown): Promise<ActionResult> {
  const session = await requireDriver();
  const parsed = tripReportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };
  const data = parsed.data;
  const loc = location as {
    status: 'captured' | 'denied' | 'unavailable' | 'unsupported';
    lat?: number | null;
    lng?: number | null;
    accuracyM?: number | null;
  } | null;

  const driverRows = await db
    .select({ assignedBusId: drivers.assignedBusId, status: drivers.status, isActive: users.isActive })
    .from(drivers)
    .innerJoin(users, eq(drivers.userId, users.id))
    .where(eq(drivers.id, session.driverId));
  const driver = driverRows[0];
  if (!driver || driver.status !== 'active' || !driver.isActive) {
    return { ok: false, error: 'Your account is not active. Contact the admin.' };
  }

  // Resolve the GPS point into a real place name (street, area, town).
  // Best effort: a slow or failed lookup never blocks the report.
  let locationAddress: string | null = null;
  if (loc?.status === 'captured' && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
    locationAddress = await reverseGeocode(loc.lat, loc.lng);
  }

  try {
    const inserted = await db
      .insert(trips)
      .values({
        clientRef: data.clientRef,
        driverId: session.driverId,
        busId: driver.assignedBusId,
        tripDate: data.tripDate,
        fromLocation: normalizeLocation(data.fromLocation),
        toLocation: normalizeLocation(data.toLocation),
        seatsLoaded: data.seatsLoaded,
        tripAmountNgn: data.tripAmountNgn,
        hasCargo: data.hasCargo,
        cargoAmountNgn: data.hasCargo ? (data.cargoAmountNgn ?? null) : null,
        fuelAmountNgn: data.fuelAmountNgn,
        feedingAmountNgn: data.feedingAmountNgn,
        arrivalTime: data.arrivalTime,
        createdByUserId: session.sub,
        lat: loc?.status === 'captured' ? (loc.lat ?? null) : null,
        lng: loc?.status === 'captured' ? (loc.lng ?? null) : null,
        accuracyM: loc?.status === 'captured' ? (loc.accuracyM ?? null) : null,
        locationAddress,
        locationStatus: loc?.status ?? 'unavailable',
      })
      .onConflictDoNothing({ target: trips.clientRef })
      .returning({ id: trips.id });

    // Only write the audit row when this call actually created the trip;
    // a duplicate submission (same clientRef) must not add a second one.
    if (inserted[0]) {
      await db.insert(tripAudit).values({
        tripId: inserted[0].id,
        action: 'created',
        actorUserId: session.sub,
        note: 'Submitted by driver',
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('trips_date_check') || msg.includes('tripDate')) {
      return { ok: false, error: 'Trip date must be today or within the last 14 days.' };
    }
    return { ok: false, error: 'Could not save the report. Check your connection and try again.' };
  }

  revalidatePath('/driver');
  revalidatePath('/admin');
  return { ok: true };
}

export async function createTripForDriver(formData: FormData): Promise<ActionResult> {
  const session = await requireAdmin();
  const driverId = String(formData.get('driverId') ?? '');
  const raw = {
    tripDate: String(formData.get('tripDate') ?? ''),
    fromLocation: String(formData.get('fromLocation') ?? ''),
    toLocation: String(formData.get('toLocation') ?? ''),
    seatsLoaded: formData.get('seatsLoaded'),
    tripAmountNgn: formData.get('tripAmountNgn'),
    hasCargo: formData.get('hasCargo') === 'yes',
    cargoAmountNgn: formData.get('cargoAmountNgn') || null,
    fuelAmountNgn: formData.get('fuelAmountNgn') ?? '0',
    feedingAmountNgn: formData.get('feedingAmountNgn') ?? '0',
    arrivalTime: String(formData.get('arrivalTime') ?? ''),
    clientRef: crypto.randomUUID(),
  };
  const parsed = tripReportSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };
  const data = parsed.data;

  const driverRows = await db
    .select({ busId: drivers.assignedBusId, userId: drivers.userId })
    .from(drivers)
    .where(eq(drivers.id, driverId));
  const driver = driverRows[0];
  if (!driver) return { ok: false, error: 'Driver not found.' };

  await db.insert(trips).values({
    clientRef: data.clientRef,
    driverId,
    busId: driver.busId,
    tripDate: data.tripDate,
    fromLocation: normalizeLocation(data.fromLocation),
    toLocation: normalizeLocation(data.toLocation),
    seatsLoaded: data.seatsLoaded,
    tripAmountNgn: data.tripAmountNgn,
    hasCargo: data.hasCargo,
    cargoAmountNgn: data.hasCargo ? (data.cargoAmountNgn ?? null) : null,
    fuelAmountNgn: data.fuelAmountNgn,
    feedingAmountNgn: data.feedingAmountNgn,
    arrivalTime: data.arrivalTime,
    createdByUserId: session.sub,
    locationStatus: 'unavailable',
  });
  await db.insert(tripAudit).values({
    tripId: (
      await db.select({ id: trips.id }).from(trips).where(eq(trips.clientRef, data.clientRef))
    )[0].id,
    action: 'created',
    actorUserId: session.sub,
    note: 'Entered by admin',
  });

  revalidatePath('/admin');
  revalidatePath('/admin/trips');
  return { ok: true };
}

export async function updateTrip(formData: FormData): Promise<ActionResult> {
  const session = await requireAdmin();
  const tripId = String(formData.get('tripId') ?? '');
  const parsed = editTripSchema.safeParse({
    tripDate: String(formData.get('tripDate') ?? ''),
    fromLocation: String(formData.get('fromLocation') ?? ''),
    toLocation: String(formData.get('toLocation') ?? ''),
    seatsLoaded: formData.get('seatsLoaded'),
    tripAmountNgn: formData.get('tripAmountNgn'),
    hasCargo: formData.get('hasCargo') === 'yes',
    cargoAmountNgn: formData.get('cargoAmountNgn') || null,
    arrivalTime: String(formData.get('arrivalTime') ?? ''),
    fuelAmountNgn: formData.get('fuelAmountNgn') ?? '0',
    feedingAmountNgn: formData.get('feedingAmountNgn') ?? '0',
    note: String(formData.get('note') ?? ''),
  });
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };
  const data = parsed.data;

  const existingRows = await db.select().from(trips).where(eq(trips.id, tripId));
  const existing = existingRows[0];
  if (!existing) return { ok: false, error: 'Trip not found.' };

  await db
    .update(trips)
    .set({
      tripDate: data.tripDate,
      fromLocation: normalizeLocation(data.fromLocation),
      toLocation: normalizeLocation(data.toLocation),
      seatsLoaded: data.seatsLoaded,
      tripAmountNgn: data.tripAmountNgn,
      hasCargo: data.hasCargo,
      cargoAmountNgn: data.hasCargo ? (data.cargoAmountNgn ?? null) : null,
      fuelAmountNgn: data.fuelAmountNgn,
      feedingAmountNgn: data.feedingAmountNgn,
      arrivalTime: data.arrivalTime,
      updatedAt: new Date(),
    })
    .where(eq(trips.id, tripId));

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const norm = (s: string) => normalizeLocation(s);
  const fields: [string, unknown, unknown][] = [
    ['tripDate', existing.tripDate, data.tripDate],
    ['fromLocation', existing.fromLocation, norm(data.fromLocation)],
    ['toLocation', existing.toLocation, norm(data.toLocation)],
    ['seatsLoaded', existing.seatsLoaded, data.seatsLoaded],
    ['tripAmountNgn', existing.tripAmountNgn, data.tripAmountNgn],
    ['hasCargo', existing.hasCargo, data.hasCargo],
    [
      'cargoAmountNgn',
      existing.cargoAmountNgn,
      data.hasCargo ? (data.cargoAmountNgn ?? null) : null,
    ],
    ['fuelAmountNgn', existing.fuelAmountNgn, data.fuelAmountNgn],
    ['feedingAmountNgn', existing.feedingAmountNgn, data.feedingAmountNgn],
    ['arrivalTime', existing.arrivalTime, data.arrivalTime],
  ];
  for (const [field, from, to] of fields) {
    if (String(from) !== String(to)) changes[field] = { from, to };
  }

  await db.insert(tripAudit).values({
    tripId,
    action: 'edited',
    actorUserId: session.sub,
    note: data.note,
    changes,
  });

  revalidatePath('/admin/trips');
  revalidatePath(`/admin/trips/${tripId}`);
  revalidatePath('/admin');
  return { ok: true };
}

export async function voidTrip(tripId: string, reason: string): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!reason || reason.trim().length < 3) {
    return { ok: false, error: 'Give a reason for voiding this report.' };
  }
  const rows = await db
    .update(trips)
    .set({
      isVoided: true,
      voidedAt: new Date(),
      voidedByUserId: session.sub,
      voidReason: reason.trim(),
      updatedAt: new Date(),
    })
    .where(and(eq(trips.id, tripId), eq(trips.isVoided, false)))
    .returning({ id: trips.id });
  if (!rows[0]) return { ok: false, error: 'Trip not found or already voided.' };

  await db.insert(tripAudit).values({
    tripId,
    action: 'voided',
    actorUserId: session.sub,
    note: reason.trim(),
  });
  revalidatePath('/admin');
  revalidatePath('/admin/trips');
  revalidatePath(`/admin/trips/${tripId}`);
  return { ok: true };
}

export async function restoreTrip(tripId: string, note: string): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!note || note.trim().length < 3) {
    return { ok: false, error: 'Give a short note for restoring this report.' };
  }
  const rows = await db
    .update(trips)
    .set({ isVoided: false, updatedAt: new Date() })
    .where(and(eq(trips.id, tripId), eq(trips.isVoided, true)))
    .returning({ id: trips.id });
  if (!rows[0]) return { ok: false, error: 'Trip not found or not voided.' };

  await db.insert(tripAudit).values({
    tripId,
    action: 'restored',
    actorUserId: session.sub,
    note: note.trim(),
  });
  revalidatePath('/admin');
  revalidatePath('/admin/trips');
  revalidatePath(`/admin/trips/${tripId}`);
  return { ok: true };
}

// ---------- Drivers ----------

export async function createDriver(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = createDriverSchema.safeParse({
    name: formData.get('name'),
    phone: formData.get('phone'),
    busId: formData.get('busId') || null,
  });
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };
  const { name, phone, busId } = parsed.data;

  const phoneExists = await db.select({ id: drivers.id }).from(drivers).where(eq(drivers.phone, phone));
  if (phoneExists[0]) {
    return { ok: false, error: 'A driver with this phone number already exists.' };
  }

  // One bus belongs to exactly one driver: refuse a bus that is taken.
  if (busId) {
    const busTaken = await db
      .select({ id: drivers.id })
      .from(drivers)
      .where(eq(drivers.assignedBusId, busId));
    if (busTaken[0]) {
      return { ok: false, error: 'That bus is already assigned to another driver. Pick a free bus.' };
    }
  }

  // The neon-http driver does not support transactions, so create the login
  // row first and remove it again if the driver row cannot be created.
  const [user] = await db
    .insert(users)
    .values({ role: 'driver', name })
    .returning({ id: users.id });
  try {
    await db.insert(drivers).values({
      userId: user.id,
      phone,
      assignedBusId: busId || null,
    });
  } catch (e) {
    await db.delete(users).where(eq(users.id, user.id));
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('unique') || msg.includes('duplicate key')) {
      return { ok: false, error: 'A driver with this phone number already exists.' };
    }
    return { ok: false, error: 'Could not create the driver. Try again.' };
  }

  revalidatePath('/admin/drivers');
  return { ok: true };
}

export async function updateDriver(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const driverId = String(formData.get('driverId') ?? '');
  const parsed = updateDriverSchema.safeParse({
    name: formData.get('name'),
    phone: formData.get('phone'),
    busId: formData.get('busId') || null,
    status: formData.get('status') || 'active',
  });
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };
  const { name, phone, busId, status } = parsed.data;

  const rows = await db.select({ userId: drivers.userId }).from(drivers).where(eq(drivers.id, driverId));
  const driver = rows[0];
  if (!driver) return { ok: false, error: 'Driver not found.' };

  const phoneTaken = await db
    .select({ id: drivers.id })
    .from(drivers)
    .where(and(eq(drivers.phone, phone), sql`${drivers.id} <> ${driverId}`));
  if (phoneTaken[0]) {
    return { ok: false, error: 'Another driver already uses this phone number.' };
  }

  // One bus belongs to exactly one driver: refuse a bus held by anyone
  // other than the driver being edited (re-assigning keeps their own bus).
  if (busId) {
    const busTaken = await db
      .select({ id: drivers.id })
      .from(drivers)
      .where(and(eq(drivers.assignedBusId, busId), sql`${drivers.id} <> ${driverId}`));
    if (busTaken[0]) {
      return { ok: false, error: 'That bus is already assigned to another driver. Pick a free bus.' };
    }
  }

  // Two independent single-row updates; no transaction needed.
  await db.update(users).set({ name, updatedAt: new Date() }).where(eq(users.id, driver.userId));
  await db
    .update(drivers)
    .set({ phone, assignedBusId: busId, status, updatedAt: new Date() })
    .where(eq(drivers.id, driverId));

  revalidatePath('/admin/drivers');
  revalidatePath(`/admin/drivers/${driverId}`);
  return { ok: true };
}

export async function resetDriverPin(
  driverId: string,
): Promise<{ ok: true; pin: string } | { ok: false; error: string }> {
  await requireAdmin();
  const rows = await db.select({ userId: drivers.userId }).from(drivers).where(eq(drivers.id, driverId));
  if (!rows[0]) return { ok: false, error: 'Driver not found.' };

  const pin = String(Math.floor(1000 + Math.random() * 9000));
  await db
    .update(drivers)
    .set({
      pinHash: hashSecret(pin),
      failedPinAttempts: 0,
      lockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(drivers.id, driverId));

  revalidatePath(`/admin/drivers/${driverId}`);
  return { ok: true, pin };
}

export async function changeOwnPin(formData: FormData): Promise<ActionResult> {
  const session = await requireDriver();
  const currentPin = String(formData.get('currentPin') ?? '');
  const newPin = String(formData.get('newPin') ?? '');
  if (!/^\d{4}$/.test(currentPin) || !/^\d{4}$/.test(newPin)) {
    return { ok: false, error: 'PINs must be exactly 4 digits.' };
  }
  const rows = await db.select({ pinHash: drivers.pinHash }).from(drivers).where(eq(drivers.id, session.driverId));
  const driver = rows[0];
  if (!driver?.pinHash) return { ok: false, error: 'Driver not found.' };
  if (!verifySecret(currentPin, driver.pinHash)) {
    return { ok: false, error: 'Your current PIN is not correct.' };
  }
  await db
    .update(drivers)
    .set({ pinHash: hashSecret(newPin), updatedAt: new Date() })
    .where(eq(drivers.id, session.driverId));
  return { ok: true };
}

// ---------- Buses ----------

export async function createBus(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = busSchema.safeParse({
    label: formData.get('label'),
    seatCapacity: formData.get('seatCapacity'),
    notes: formData.get('notes') || null,
  });
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };
  const { label, seatCapacity, notes } = parsed.data;
  await db.insert(buses).values({ label, seatCapacity, notes: notes ?? null });
  revalidatePath('/admin/buses');
  return { ok: true };
}

export async function updateBus(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const busId = String(formData.get('busId') ?? '');
  const parsed = busSchema.safeParse({
    label: formData.get('label'),
    seatCapacity: formData.get('seatCapacity'),
    notes: formData.get('notes') || null,
    status: formData.get('status') || 'active',
  });
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };
  const { label, seatCapacity, notes, status } = parsed.data;
  await db
    .update(buses)
    .set({ label, seatCapacity, notes: notes ?? null, status, updatedAt: new Date() })
    .where(eq(buses.id, busId));
  revalidatePath('/admin/buses');
  return { ok: true };
}

// ---------- Admin team ----------

export async function createAdmin(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = createAdminSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };
  const { name, email, password } = parsed.data;

  const exists = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, email), eq(users.role, 'admin')));
  if (exists[0]) return { ok: false, error: 'An admin with this email already exists.' };

  await db.insert(users).values({
    role: 'admin',
    name,
    email,
    passwordHash: hashSecret(password),
  });
  revalidatePath('/admin/team');
  return { ok: true };
}

// Any signed-in admin changes their own password. The current password
// must be confirmed first, and the session cookie stays as it is.
export async function changeOwnPassword(formData: FormData): Promise<ActionResult> {
  const session = await requireAdmin();
  const currentPassword = String(formData.get('currentPassword') ?? '');
  const newPassword = String(formData.get('newPassword') ?? '');
  const confirmPassword = String(formData.get('confirmPassword') ?? '');

  if (newPassword.length < 8) {
    return { ok: false, error: 'New password must be at least 8 characters.' };
  }
  if (newPassword !== confirmPassword) {
    return { ok: false, error: 'The two new passwords do not match.' };
  }
  if (newPassword === currentPassword) {
    return { ok: false, error: 'The new password must be different from the current one.' };
  }

  const rows = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, session.sub));
  const me = rows[0];
  if (!me?.passwordHash || !verifySecret(currentPassword, me.passwordHash)) {
    return { ok: false, error: 'Your current password is not correct.' };
  }

  await db
    .update(users)
    .set({ passwordHash: hashSecret(newPassword), updatedAt: new Date() })
    .where(eq(users.id, session.sub));
  revalidatePath('/admin/team');
  return { ok: true };
}

export async function setAdminActive(formData: FormData): Promise<ActionResult> {
  const session = await requireAdmin();
  const userId = String(formData.get('userId') ?? '');
  const active = formData.get('active') === 'true';
  if (userId === session.sub) {
    return { ok: false, error: 'You cannot deactivate your own account.' };
  }
  await db
    .update(users)
    .set({ isActive: active, updatedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.role, 'admin')));
  revalidatePath('/admin/team');
  return { ok: true };
}

// ---------- Helpers ----------

/** Trim and normalize location casing for consistent records: "enugu " -> "Enugu". */
function normalizeLocation(input: string): string {
  const trimmed = input.trim().replace(/\s+/g, ' ');
  if (!trimmed) return trimmed;
  // Keep all-caps inputs like "PMT" or abbreviations, normalize lowercase words to Title Case.
  if (trimmed === trimmed.toUpperCase()) return trimmed;
  return trimmed
    .split(' ')
    .map((word) =>
      word.length > 1 && word === word.toLowerCase()
        ? word.charAt(0).toUpperCase() + word.slice(1)
        : word,
    )
    .join(' ');
}
